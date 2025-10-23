import React, { useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const BaccaratAnalyzerApp = () => {
  const [initialBankroll, setInitialBankroll] = useState(1000);
  const [initialBet, setInitialBet] = useState(10);
  const [numSimulations, setNumSimulations] = useState(100);
  const [numRounds, setNumRounds] = useState(200);
  const [patternVerification, setPatternVerification] = useState(4);
  
  const [showSettings, setShowSettings] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('winrate');
  
  const [results, setResults] = useState(null);
  const [allResults, setAllResults] = useState([]);

  const simulateRound = useCallback(() => {
    const playerScore = Math.floor(Math.random() * 10);
    const bankerScore = Math.floor(Math.random() * 10);
    
    let winner;
    if (playerScore > bankerScore) winner = 'Player';
    else if (bankerScore > playerScore) winner = 'Banker';
    else winner = 'Tie';
    
    const diff = Math.abs(playerScore - bankerScore);
    const diffType = diff % 2 === 0 ? 'Even' : 'Odd';
    
    return { playerScore, bankerScore, winner, diffType };
  }, []);

  const getSuggestedBet = useCallback((history) => {
    const nonTieRounds = history.filter(r => r.winner !== 'Tie');
    if (nonTieRounds.length < 1) return null;
    
    const lastRound = nonTieRounds[nonTieRounds.length - 1];
    const { diffType, winner } = lastRound;
    
    if (diffType === 'Even') {
      return winner === 'Player' ? 'Banker' : 'Player';
    } else {
      return winner;
    }
  }, []);

  const verifyPattern = useCallback((history) => {
    const nonTieRounds = history.filter(r => r.winner !== 'Tie');
    if (nonTieRounds.length < 2) return false;
    
    const prevRound = nonTieRounds[nonTieRounds.length - 2];
    const currRound = nonTieRounds[nonTieRounds.length - 1];
    
    if (prevRound.diffType === 'Even') {
      return prevRound.winner !== currRound.winner;
    } else {
      return prevRound.winner === currRound.winner;
    }
  }, []);

  const runSingleSimulation = useCallback(() => {
    let history = [];
    let bankroll = initialBankroll;
    const bankrollHistory = [bankroll];
    let betAmount = initialBet;
    let currentBet = null;
    let patternVerified = false;
    let verificationCount = 0;
    let consecutiveLosses = 0;
    let winCount = 0;
    let lossCount = 0;
    let peakBankroll = initialBankroll;
    let maxDrawdown = 0;
    const betAmountsUsed = [];

    for (let i = 0; i < numRounds; i++) {
      const result = simulateRound();
      history.push(result);

      if (result.winner !== 'Tie') {
        if (verifyPattern(history)) {
          verificationCount++;
          if (verificationCount >= patternVerification) {
            patternVerified = true;
          }
        }

        if (patternVerified && currentBet && result.winner !== 'Tie') {
          if (currentBet === result.winner) {
            bankroll += betAmount;
            betAmount = initialBet;
            consecutiveLosses = 0;
            winCount++;
            betAmountsUsed.push(betAmount);
          } else {
            bankroll -= betAmount;
            consecutiveLosses++;
            betAmount *= 2;
            lossCount++;
            betAmountsUsed.push(betAmount);
          }
        }

        if (patternVerified) {
          currentBet = getSuggestedBet(history);
        }
      }

      if (bankroll > peakBankroll) peakBankroll = bankroll;
      const drawdown = peakBankroll > 0 ? (peakBankroll - bankroll) / peakBankroll : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      bankrollHistory.push(bankroll);
    }

    const winRate = (winCount + lossCount) > 0 ? winCount / (winCount + lossCount) : 0;

    const returns = [];
    for (let i = 1; i < bankrollHistory.length; i++) {
      if (bankrollHistory[i - 1] > 0) {
        returns.push((bankrollHistory[i] - bankrollHistory[i - 1]) / bankrollHistory[i - 1]);
      }
    }
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdReturn = returns.length > 0 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) : 0;
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn * Math.sqrt(returns.length)) : 0;

    return {
      bankrollHistory,
      finalBankroll: bankroll,
      profit: bankroll - initialBankroll,
      winCount,
      lossCount,
      winRate,
      maxDrawdown,
      peakBankroll,
      betAmountsUsed,
      sharpeRatio
    };
  }, [initialBankroll, initialBet, numRounds, patternVerification, simulateRound, verifyPattern, getSuggestedBet]);

  const runSimulations = async () => {
    setIsRunning(true);
    setProgress(0);
    const simulationResults = [];

    for (let i = 0; i < numSimulations; i++) {
      const result = runSingleSimulation();
      simulationResults.push(result);
      setProgress(((i + 1) / numSimulations) * 100);
      
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const winRates = simulationResults.map(r => r.winRate);
    const profits = simulationResults.map(r => r.profit);
    const maxDrawdowns = simulationResults.map(r => r.maxDrawdown);
    const sharpeRatios = simulationResults.map(r => r.sharpeRatio);

    const stats = {
      avgWinRate: winRates.reduce((a, b) => a + b, 0) / winRates.length,
      medianWinRate: median(winRates),
      minWinRate: Math.min(...winRates),
      maxWinRate: Math.max(...winRates),
      avgProfit: profits.reduce((a, b) => a + b, 0) / profits.length,
      medianProfit: median(profits),
      minProfit: Math.min(...profits),
      maxProfit: Math.max(...profits),
      positiveProfitRate: profits.filter(p => p > 0).length / profits.length,
      avgMaxDrawdown: maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length,
      medianMaxDrawdown: median(maxDrawdowns),
      maxMaxDrawdown: Math.max(...maxDrawdowns),
      avgSharpeRatio: sharpeRatios.reduce((a, b) => a + b, 0) / sharpeRatios.length,
      medianSharpeRatio: median(sharpeRatios),
      winRates,
      profits,
      maxDrawdowns,
      sharpeRatios
    };

    setResults(stats);
    setAllResults(simulationResults);
    setIsRunning(false);
  };

  const median = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const getWinRateHistogram = () => {
    if (!results) return [];
    const bins = 20;
    const min = 0;
    const max = 1;
    const binSize = (max - min) / bins;
    const histogram = Array(bins).fill(0);

    results.winRates.forEach(wr => {
      const binIndex = Math.min(Math.floor((wr - min) / binSize), bins - 1);
      histogram[binIndex]++;
    });

    return histogram.map((count, i) => ({
      range: `${(i * binSize * 100).toFixed(0)}-${((i + 1) * binSize * 100).toFixed(0)}%`,
      count
    }));
  };

  const getProfitHistogram = () => {
    if (!results) return [];
    const bins = 20;
    const min = results.minProfit;
    const max = results.maxProfit;
    const binSize = (max - min) / bins;
    const histogram = Array(bins).fill(0);

    results.profits.forEach(p => {
      const binIndex = Math.min(Math.floor((p - min) / binSize), bins - 1);
      histogram[binIndex]++;
    });

    return histogram.map((count, i) => ({
      range: `$${(min + i * binSize).toFixed(0)}`,
      count
    }));
  };

  const getAvgBankrollProgression = () => {
    if (!allResults.length) return [];
    
    const maxLength = Math.max(...allResults.map(r => r.bankrollHistory.length));
    const avgProgression = [];

    for (let i = 0; i < maxLength; i++) {
      const values = allResults
        .map(r => r.bankrollHistory[i])
        .filter(v => v !== undefined);
      
      if (values.length > 0) {
        avgProgression.push({
          round: i,
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          p25: percentile(values, 25),
          p75: percentile(values, 75)
        });
      }
    }

    return avgProgression;
  };

  const percentile = (arr, p) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  const getDrawdownHistogram = () => {
    if (!results) return [];
    const bins = 15;
    const min = 0;
    const max = Math.max(...results.maxDrawdowns);
    const binSize = (max - min) / bins;
    const histogram = Array(bins).fill(0);

    results.maxDrawdowns.forEach(dd => {
      const binIndex = Math.min(Math.floor((dd - min) / binSize), bins - 1);
      histogram[binIndex]++;
    });

    return histogram.map((count, i) => ({
      range: `${(i * binSize * 100).toFixed(0)}-${((i + 1) * binSize * 100).toFixed(0)}%`,
      count
    }));
  };

  const getSharpeHistogram = () => {
    if (!results) return [];
    const bins = 15;
    const min = Math.min(...results.sharpeRatios);
    const max = Math.max(...results.sharpeRatios);
    const binSize = (max - min) / bins;
    const histogram = Array(bins).fill(0);

    results.sharpeRatios.forEach(sr => {
      const binIndex = Math.min(Math.floor((sr - min) / binSize), bins - 1);
      histogram[binIndex]++;
    });

    return histogram.map((count, i) => ({
      range: (min + i * binSize).toFixed(2),
      count
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="bg-black bg-opacity-50 backdrop-blur-lg border-b border-purple-500 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-2xl">
                📊
              </div>
              <div>
                <h1 className="text-lg font-bold">Baccarat Analyzer</h1>
                <p className="text-xs text-gray-400">Strategy Simulation</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">⚙️ Simulation Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">💰 Initial Bankroll ($)</label>
                <input
                  type="number"
                  value={initialBankroll}
                  onChange={(e) => setInitialBankroll(Number(e.target.value))}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                  min="100"
                  step="100"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-2">🎲 Initial Bet ($)</label>
                <input
                  type="number"
                  value={initialBet}
                  onChange={(e) => setInitialBet(Number(e.target.value))}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                  min="1"
                  step="5"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-2">🔄 Number of Simulations</label>
                <input
                  type="number"
                  value={numSimulations}
                  onChange={(e) => setNumSimulations(Number(e.target.value))}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                  min="10"
                  step="10"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-2">🎯 Number of Rounds</label>
                <input
                  type="number"
                  value={numRounds}
                  onChange={(e) => setNumRounds(Number(e.target.value))}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                  min="50"
                  step="50"
                />
              </div>
              
              <div>
                <label className="block text-sm mb-2">✓ Pattern Verification</label>
                <input
                  type="number"
                  value={patternVerification}
                  onChange={(e) => setPatternVerification(Number(e.target.value))}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                  min="1"
                  max="10"
                />
              </div>
            </div>
            
            <button
              onClick={() => setShowSettings(false)}
              className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 py-3 rounded-lg font-bold"
            >
              ✓ Done
            </button>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-4 space-y-4 max-w-6xl">
        
        <button
          onClick={runSimulations}
          disabled={isRunning}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
            isRunning
              ? 'bg-gradient-to-r from-gray-600 to-gray-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
          }`}
        >
          {isRunning ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              Running... {progress.toFixed(0)}%
            </>
          ) : (
            <>▶️ Run {numSimulations} Simulations</>
          )}
        </button>

        {isRunning && (
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        {results && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 shadow-lg">
              <div className="text-xs opacity-90 mb-1">Avg Win Rate</div>
              <div className="text-2xl font-bold">{(results.avgWinRate * 100).toFixed(1)}%</div>
              <div className="text-xs text-green-200">Med: {(results.medianWinRate * 100).toFixed(1)}%</div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 shadow-lg">
              <div className="text-xs opacity-90 mb-1">Avg Profit</div>
              <div className="text-2xl font-bold">${results.avgProfit.toFixed(0)}</div>
              <div className="text-xs text-blue-200">Med: ${results.medianProfit.toFixed(0)}</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-4 shadow-lg">
              <div className="text-xs opacity-90 mb-1">Win Rate</div>
              <div className="text-2xl font-bold">{(results.positiveProfitRate * 100).toFixed(1)}%</div>
              <div className="text-xs text-purple-200">Profitable Sims</div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-4 shadow-lg">
              <div className="text-xs opacity-90 mb-1">Max Drawdown</div>
              <div className="text-2xl font-bold">{(results.avgMaxDrawdown * 100).toFixed(1)}%</div>
              <div className="text-xs text-orange-200">Avg Risk</div>
            </div>
          </div>
        )}

        {results && (
          <>
            <div className="bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-xl p-2 flex gap-2 overflow-x-auto">
              {[
                { id: 'winrate', label: '📈 Win Rate' },
                { id: 'profit', label: '💵 Profit' },
                { id: 'bankroll', label: '📉 Bankroll' },
                { id: 'risk', label: '⚠️ Risk' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-xl p-4">
              {activeTab === 'winrate' && (
                <div>
                  <h3 className="font-bold mb-3 text-lg">📈 Win Rate Distribution</h3>
                  <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 mb-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-400">Min:</span> <span className="font-bold">{(results.minWinRate * 100).toFixed(1)}%</span></div>
                      <div><span className="text-gray-400">Max:</span> <span className="font-bold">{(results.maxWinRate * 100).toFixed(1)}%</span></div>
                      <div><span className="text-gray-400">Avg:</span> <span className="font-bold text-yellow-400">{(results.avgWinRate * 100).toFixed(1)}%</span></div>
                      <div><span className="text-gray-400">Med:</span> <span className="font-bold text-green-400">{(results.medianWinRate * 100).toFixed(1)}%</span></div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getWinRateHistogram()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="range" stroke="#9CA3AF" angle={-45} textAnchor="end" height={80} fontSize={10} />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                      />
                      <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {activeTab === 'profit' && (
                <div>
                  <h3 className="font-bold mb-3 text-lg">💵 Profit Distribution</h3>
                  <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 mb-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-400">Min:</span> <span className="font-bold text-red-400">${results.minProfit.toFixed(0)}</span></div>
                      <div><span className="text-gray-400">Max:</span> <span className="font-bold text-green-400">${results.maxProfit.toFixed(0)}</span></div>
                      <div><span className="text-gray-400">Avg:</span> <span className="font-bold text-yellow-400">${results.avgProfit.toFixed(0)}</span></div>
                      <div><span className="text-gray-400">Med:</span> <span className="font-bold">${results.medianProfit.toFixed(0)}</span></div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getProfitHistogram()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="range" stroke="#9CA3AF" angle={-45} textAnchor="end" height={80} fontSize={10} />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {activeTab === 'bankroll' && (
                <div>
                  <h3 className="font-bold mb-3 text-lg">📉 Average Bankroll Progression</h3>
                  <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 mb-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-400">Initial:</span> <span className="font-bold">${initialBankroll}</span></div>
                      <div><span className="text-gray-400">Final Avg:</span> <span className="font-bold text-blue-400">${(initialBankroll + results.avgProfit).toFixed(0)}</span></div>
                      <div><span className="text-gray-400">Change:</span> <span className={`font-bold ${results.avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{results.avgProfit >= 0 ? '+' : ''}${results.avgProfit.toFixed(0)}</span></div>
                      <div><span className="text-gray-400">ROI:</span> <span className={`font-bold ${results.avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{((results.avgProfit / initialBankroll) * 100).toFixed(1)}%</span></div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={getAvgBankrollProgression()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="round" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        formatter={(value) => `$${value.toFixed(0)}`}
                      />
                      <Area type="monotone" dataKey="p75" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="avg" stackId="2" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
                      <Area type="monotone" dataKey="p25" stackId="3" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {activeTab === 'risk' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold mb-3 text-lg">⚠️ Maximum Drawdown Distribution</h3>
                    <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 mb-4">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-400">Avg:</span> <span className="font-bold text-orange-400">{(results.avgMaxDrawdown * 100).toFixed(1)}%</span></div>
                        <div><span className="text-gray-400">Med:</span> <span className="font-bold">{(results.medianMaxDrawdown * 100).toFixed(1)}%</span></div>
                        <div><span className="text-gray-400">Max:</span> <span className="font-bold text-red-400">{(results.maxMaxDrawdown * 100).toFixed(1)}%</span></div>
                        <div><span className="text-gray-400">Sharpe:</span> <span className="font-bold text-blue-400">{results.avgSharpeRatio.toFixed(3)}</span></div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={getDrawdownHistogram()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="range" stroke="#9CA3AF" angle={-45} textAnchor="end" height={80} fontSize={10} />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <h3 className="font-bold mb-3 text-lg">📊 Sharpe Ratio Distribution</h3>
                    <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 mb-4 text-sm">
                      <p className="text-gray-300 mb-2">
                        The Sharpe Ratio measures risk-adjusted returns. Higher is better.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-gray-400">Avg:</span> <span className="font-bold text-purple-400">{results.avgSharpeRatio.toFixed(3)}</span></div>
                        <div><span className="text-gray-400">Med:</span> <span className="font-bold">{results.medianSharpeRatio.toFixed(3)}</span></div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={getSharpeHistogram()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="range" stroke="#9CA3AF" angle={-45} textAnchor="end" height={80} fontSize={10} />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!results && !isRunning && (
          <div className="bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold mb-2">Baccarat Strategy Analyzer</h2>
            <p className="text-gray-400 mb-6">
              Run comprehensive simulations to analyze the effectiveness of your baccarat betting strategy.
            </p>
            <div className="grid md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
              <div className="bg-gray-900 bg-opacity-50 p-4 rounded-lg">
                <div className="text-2xl mb-2">🎯</div>
                <h3 className="font-bold mb-1">Pattern Detection</h3>
                <p className="text-sm text-gray-400">Analyzes even/odd score differentials to predict outcomes</p>
              </div>
              <div className="bg-gray-900 bg-opacity-50 p-4 rounded-lg">
                <div className="text-2xl mb-2">💰</div>
                <h3 className="font-bold mb-1">Martingale System</h3>
                <p className="text-sm text-gray-400">Doubles bet after losses to recover previous losses</p>
              </div>
              <div className="bg-gray-900 bg-opacity-50 p-4 rounded-lg">
                <div className="text-2xl mb-2">📈</div>
                <h3 className="font-bold mb-1">Statistical Analysis</h3>
                <p className="text-sm text-gray-400">Win rates, profit distribution, risk metrics and more</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-800 bg-opacity-30 rounded-xl p-4 text-center text-sm text-gray-400">
          <p>⚠️ This is a simulation tool for educational purposes only. Past performance does not guarantee future results.</p>
        </div>
      </div>
    </div>
  );
};

export default BaccaratAnalyzerApp;