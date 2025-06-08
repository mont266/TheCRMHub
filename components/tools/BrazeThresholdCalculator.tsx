import React, { useState, useEffect, useCallback } from 'react';
import { ToolProps } from '../../types';
import { ArrowLeftIcon } from '../icons';

const BrazeThresholdCalculator: React.FC<ToolProps> = ({ onClose, theme }) => {
  const [sendVolume, setSendVolume] = useState<string>('');
  const [globalControl, setGlobalControl] = useState<boolean>(false);
  const [hasSendLimit, setHasSendLimit] = useState<boolean>(false);
  const [dailySendLimit, setDailySendLimit] = useState<string>('');
  const [lowerThreshold, setLowerThreshold] = useState<string>('0');
  const [upperThreshold, setUpperThreshold] = useState<string>('0');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  const calculateThresholds = useCallback(() => {
    let baseVolume = parseFloat(sendVolume) || 0;

    if (hasSendLimit) {
      const dailyLimit = parseFloat(dailySendLimit) || 0;
      if (dailyLimit > 0) {
        baseVolume = dailyLimit;
      }
    }

    let lowerThresholdPercentage;
    let upperThresholdPercentage;

    if (globalControl) {
      lowerThresholdPercentage = 0.11; // 11%
      upperThresholdPercentage = 0.01;  // 1%
    } else {
      lowerThresholdPercentage = 0.02;  // 2%
      upperThresholdPercentage = 0.01;  // 1%
    }

    const lowerThresholdAmount = baseVolume * lowerThresholdPercentage;
    const upperThresholdAmount = baseVolume * upperThresholdPercentage;

    const displayedLowerThreshold = baseVolume - lowerThresholdAmount;
    let displayedUpperThreshold = baseVolume + upperThresholdAmount;

    if (Math.floor(displayedUpperThreshold) < (baseVolume + 1)) {
      displayedUpperThreshold = baseVolume + 1;
    }

    setLowerThreshold(Math.floor(displayedLowerThreshold).toLocaleString());
    setUpperThreshold(Math.floor(displayedUpperThreshold).toLocaleString());
  }, [sendVolume, globalControl, hasSendLimit, dailySendLimit]);

  useEffect(() => {
    if (!hasSendLimit) {
      setDailySendLimit(''); // Clear daily send limit if checkbox is unticked
    }
  }, [hasSendLimit]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    calculateThresholds(); 
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
    }, 500); 
  };

  const colorSchemeClass = theme === 'light' ? '[color-scheme:light]' : '[color-scheme:dark]';
  const inputClasses = `mt-1 block w-full px-3 py-2 bg-crm-background dark:bg-crm-dm-background border border-crm-border dark:border-crm-dm-border rounded-md shadow-sm focus:outline-none focus:ring-crm-accent focus:border-crm-accent sm:text-sm transition-colors duration-300 ${colorSchemeClass}`;
  const labelClasses = "block text-sm font-medium text-crm-text-body dark:text-crm-dm-text-body transition-colors duration-300";
  const checkboxLabelClasses = "ml-2 text-sm text-crm-text-body dark:text-crm-dm-text-body transition-colors duration-300";
  const cardClasses = "bg-crm-card dark:bg-crm-dm-card p-6 sm:p-8 rounded-xl shadow-xl dark:shadow-2xl transition-colors duration-300";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-semibold text-crm-text-heading dark:text-crm-dm-text-heading transition-colors duration-300">
          Braze Alert Threshold Calculator
        </h2>
        <button
          onClick={onClose}
          className="flex items-center text-crm-accent hover:underline text-sm font-medium"
          aria-label="Back to Hub"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Back to Hub
        </button>
      </div>

      <form onSubmit={handleSubmit} className={`space-y-6 ${cardClasses}`}>
        <div>
          <label htmlFor="sendVolume" className={labelClasses}>
            Expected Send Volume
          </label>
          <input
            type="number"
            id="sendVolume"
            value={sendVolume}
            onChange={(e) => setSendVolume(e.target.value)}
            className={inputClasses}
            placeholder="e.g., 100000"
            min="0"
          />
        </div>

        <div className="flex items-center">
          <input
            id="globalControl"
            type="checkbox"
            checked={globalControl}
            onChange={(e) => setGlobalControl(e.target.checked)}
            className="h-4 w-4 text-crm-accent bg-white dark:bg-slate-700 border-crm-border dark:border-crm-dm-border rounded focus:ring-crm-accent"
          />
          <label htmlFor="globalControl" className={checkboxLabelClasses}>
            Does the global control receive this campaign?
          </label>
        </div>

        <div className="flex items-center">
          <input
            id="hasSendLimit"
            type="checkbox"
            checked={hasSendLimit}
            onChange={(e) => setHasSendLimit(e.target.checked)}
            className="h-4 w-4 text-crm-accent bg-white dark:bg-slate-700 border-crm-border dark:border-crm-dm-border rounded focus:ring-crm-accent"
          />
          <label htmlFor="hasSendLimit" className={checkboxLabelClasses}>
            Use Daily Send Limit for calculation?
          </label>
        </div>

        {hasSendLimit && (
          <div>
            <label htmlFor="dailySendLimit" className={labelClasses}>
              Daily Send Limit
            </label>
            <input
              type="number"
              id="dailySendLimit"
              value={dailySendLimit}
              onChange={(e) => setDailySendLimit(e.target.value)}
              className={inputClasses}
              placeholder="e.g., 50000"
              min="0"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isCalculating}
          className={`w-full bg-gradient-to-r from-fuchsia-500 via-sky-400 to-violet-500 text-crm-button-text font-semibold py-3 px-4 rounded-lg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-crm-accent focus:ring-offset-crm-card dark:focus:ring-offset-crm-dm-card transition-all duration-300 ${
            isCalculating ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          {isCalculating ? 'Calculating...' : 'Calculate Thresholds'}
        </button>
      </form>

      <div className={`${cardClasses} space-y-4`}>
        <h3 className="text-xl font-semibold text-crm-text-heading dark:text-crm-dm-text-heading transition-colors duration-300">Results:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-crm-background dark:bg-crm-dm-background p-4 rounded-lg shadow">
                <p className={`${labelClasses} mb-1`}>Calculated Lower Threshold:</p>
                <p className="text-2xl font-bold text-crm-accent" aria-live="polite">{lowerThreshold}</p>
            </div>
            <div className="bg-crm-background dark:bg-crm-dm-background p-4 rounded-lg shadow">
                <p className={`${labelClasses} mb-1`}>Calculated Upper Threshold:</p>
                <p className="text-2xl font-bold text-crm-accent" aria-live="polite">{upperThreshold}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default BrazeThresholdCalculator;