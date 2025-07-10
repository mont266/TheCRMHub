
import React, { useState, useCallback, useMemo, ChangeEvent, useRef, useEffect } from 'react';
import { ToolProps } from '../../types';
import { ArrowLeftIcon, XMarkIcon, BeakerIcon } from '../icons'; // Added BeakerIcon for WIP

const CHECKMARK_SVG_DATA_URI = "data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e";
const SIGNIFICANCE_THRESHOLD = 0.05; // p < 0.05 for 95% confidence

interface VariantMetrics {
  sends: string;
  uniqueOpens: string; // Email only
  uniqueClicks: string;
  // Generic commercial
  conversions: string;
  averageValuePerConversion: string;
  // 1066 Mode specific commercial - direct inputs
  srrRateInput: string; 
  mrrRateInput: string; 
  averageIppInput: string; 
}

interface Variant extends VariantMetrics {
  id: string;
  name: string;
}

const initialMetrics: Omit<VariantMetrics, 'id' | 'name'> = {
  sends: '',
  uniqueOpens: '',
  uniqueClicks: '',
  conversions: '',
  averageValuePerConversion: '',
  srrRateInput: '',
  mrrRateInput: '',
  averageIppInput: '',
};

const createNewVariant = (idNumeric: number, name?: string): Variant => ({
  id: `variant-${idNumeric}`,
  name: name || `Variant ${String.fromCharCode(65 + idNumeric)}`, // Variant A, B, C...
  ...initialMetrics,
});

type TestType = 'engagement'; 
type Channel = 'email' | 'sms';
type Currency = 'GBP' | 'USD' | 'EUR';
type MetricNameOption = "SRR" | "MRR" | "IPP" | "custom";

const currencySymbols: Record<Currency, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
};

const predefinedMetricNames: MetricNameOption[] = ["SRR", "MRR", "IPP"];

type SignificanceInfo = {
  pValue: number | null;
  isSignificant: boolean;
};

type RateData = {
  id: string;
  name: string;
  // Raw counts for significance (generic metrics)
  sendsRaw: number | null;
  uniqueOpensRaw: number | null;
  uniqueClicksRaw: number | null;
  conversionsRaw: number | null; 

  // Calculated rates
  openRate: string;
  clickThroughRate: string;
  conversionRate: string; // Generic commercial
  totalRevenue: string; // Generic commercial
  srrRate: string;    // 1066 (from srrRateInput)
  mrrRate: string;    // 1066 (from mrrRateInput)
  averageIpp: string; // 1066 (from averageIppInput)

  // Significance results (compared to control) - applicable for engagement & generic commercial
  openRateSig?: SignificanceInfo;
  clickThroughRateSig?: SignificanceInfo;
  conversionRateSig?: SignificanceInfo;
  // SRR/MRR/IPP in 1066 mode will not have pValue/isSignificant from Z-test
};


interface KpiWinnerInfo {
  winnerVariantName: string;
  winnerKpiValue: string;
  controlKpiValue: string;
  performanceChangePercent: number | null;
  isConclusive: boolean;
  kpiDisplayName: string;
  significance?: SignificanceInfo; // Only relevant for metrics with significance testing
}

interface TestConclusionData {
    summaryText: React.ReactNode;
    overallWinnerVariantName: string | null;
    isFlatResult: boolean;
    winningKpiPerformanceChange: number | null; 
}

// Standard Normal Cumulative Distribution Function (CDF)
function standardNormalCdf(x: number): number {
    const a1 =  0.254829592; const a2 = -0.284496736; const a3 =  1.421413741;
    const a4 = -1.453152027; const a5 =  1.061405429; const p  =  0.3275911;
    let sign = 1; if (x < 0) sign = -1; x = Math.abs(x) / Math.sqrt(2.0);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
}

// Calculates rate and significance for metrics with underlying counts
function calculateRateAndSignificance(
    successes1: number, trials1: number, 
    successes2: number, trials2: number  
): { rate1: string, rate2: string, pValue: number | null, isSignificant: boolean } {
    if (trials1 <= 0 || trials2 <= 0 || successes1 < 0 || successes2 < 0 || successes1 > trials1 || successes2 > trials2) {
        const r1 = trials1 > 0 ? ((successes1 / trials1) * 100).toFixed(2) + '%' : 'N/A';
        const r2 = trials2 > 0 ? ((successes2 / trials2) * 100).toFixed(2) + '%' : 'N/A';
        return { rate1: r1, rate2: r2, pValue: null, isSignificant: false };
    }

    const p1 = successes1 / trials1;
    const p2 = successes2 / trials2;
    const rate1Str = (p1 * 100).toFixed(2) + '%';
    const rate2Str = (p2 * 100).toFixed(2) + '%';

    // Basic check for Z-test validity (e.g., expected successes/failures > 5)
    // Also, if rates are identical, p-value is 1 (or close to it) and not significant.
    if (trials1 * p1 < 5 || trials1 * (1-p1) < 5 || trials2 * p2 < 5 || trials2 * (1-p2) < 5 || p1 === p2) {
        return { rate1: rate1Str, rate2: rate2Str, pValue: p1 === p2 ? 1.0 : null, isSignificant: false }; 
    }

    const pPooled = (successes1 + successes2) / (trials1 + trials2);
    if (pPooled === 0 || pPooled === 1) { 
         return { rate1: rate1Str, rate2: rate2Str, pValue: p1 === p2 ? 1.0 : null, isSignificant: false };
    }
    
    const standardError = Math.sqrt(pPooled * (1 - pPooled) * (1 / trials1 + 1 / trials2));
    if (standardError === 0) {
        // This case should ideally be caught by p1 === p2 or pPooled checks, but as a fallback:
        return { rate1: rate1Str, rate2: rate2Str, pValue: p1 === p2 ? 1.0 : 0.0, isSignificant: p1 !== p2 };
    }

    const zScore = (p2 - p1) / standardError; 
    const pValue = 2 * (1 - standardNormalCdf(Math.abs(zScore))); 

    return {
        rate1: rate1Str,
        rate2: rate2Str,
        pValue: isNaN(pValue) ? null : pValue,
        isSignificant: !isNaN(pValue) && pValue < SIGNIFICANCE_THRESHOLD,
    };
}


const TestAnalysisTool: React.FC<ToolProps> = ({ onClose, theme }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [testName, setTestName] = useState<string>('');
  const [testType, setTestType] = useState<TestType>('engagement');
  const [channel, setChannel] = useState<Channel>('email');
  const [primaryEngagementMetric, setPrimaryEngagementMetric] = useState<'openRate' | 'clickThroughRate'>('clickThroughRate');
  
  const [variantsData, setVariantsData] = useState<Variant[]>([
    createNewVariant(0, 'Variant A'),
    createNewVariant(1, 'Variant B'),
  ]);
  const [controlVariantId, setControlVariantId] = useState<string>(variantsData[0].id);
  const [nextVariantNumericId, setNextVariantNumericId] = useState<number>(2);
  
  const [includeCommercial, setIncludeCommercial] = useState<boolean>(false);
  const [conversionMetricName, setConversionMetricName] = useState<string>('Purchases');
  const [metricNameSelectionOption, setMetricNameSelectionOption] = useState<MetricNameOption | 'custom'>('custom');
  const [currency, setCurrency] = useState<Currency>('GBP');

  const [isDevToolsVisible, setIsDevToolsVisible] = useState<boolean>(false);
  const [is1066ModeActive, setIs1066ModeActive] = useState<boolean>(() => {
    const savedMode = localStorage.getItem('is1066ModeActive');
    return savedMode === 'true';
  });
  const backToHubButtonRef = useRef<HTMLButtonElement>(null);
  const [isReviewDetailsExpanded, setIsReviewDetailsExpanded] = useState<boolean>(false);
  const [testConclusion, setTestConclusion] = useState<TestConclusionData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgressText, setAnalysisProgressText] = useState<string>('');

  const totalSteps = 4;

  useEffect(() => {
    localStorage.setItem('is1066ModeActive', String(is1066ModeActive));
  }, [is1066ModeActive]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey && event.shiftKey && (event.key === 'L' || event.key === 'l')) {
            event.preventDefault();
            setIs1066ModeActive(prev => !prev);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);


  useEffect(() => {
    if (predefinedMetricNames.includes(conversionMetricName as MetricNameOption)) {
        setMetricNameSelectionOption(conversionMetricName as MetricNameOption);
    } else {
        setMetricNameSelectionOption('custom');
    }
  }, [conversionMetricName]);

  const parseInputAsNumber = (value: string): number | null => {
    const num = parseFloat(value);
    return isNaN(num) || num < 0 ? null : num;
  };
  
  const formatPercentageInput = (valueStr: string | undefined): string => {
    if (valueStr === undefined || valueStr.trim() === '') return 'N/A';
    const num = parseFloat(valueStr);
    if (isNaN(num)) return 'N/A';
    return num.toFixed(2) + '%';
  };

  const calculateTotalValue = (conversionsStr: string, aovStr: string, selectedCurrency: Currency): string => {
    const conversions = parseFloat(conversionsStr);
    const aov = parseFloat(aovStr);
    if (isNaN(conversions) || isNaN(aov) || conversions < 0 || aov < 0) {
      return 'N/A';
    }
    return (conversions * aov).toLocaleString(undefined, { style: 'currency', currency: selectedCurrency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatAsCurrency = (valueStr: string | undefined, selectedCurrency: Currency): string => {
    if (valueStr === undefined || valueStr.trim() === '') return 'N/A';
    const num = parseFloat(valueStr);
    if (isNaN(num) || num < 0) {
        return 'N/A';
    }
    return num.toLocaleString(undefined, { style: 'currency', currency: selectedCurrency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getVariantCalculatedRates = useCallback((
        variantData: Variant,
        controlVariantData: Variant | undefined, 
        currentChannel: Channel,
        selectedCurrency: Currency,
        mode1066Active: boolean,
        commercialIncluded: boolean
    ): Omit<RateData, 'id' | 'name'> => {
        const sendsRaw = parseInputAsNumber(variantData.sends);
        const uniqueOpensRaw = parseInputAsNumber(variantData.uniqueOpens);
        const uniqueClicksRaw = parseInputAsNumber(variantData.uniqueClicks);
        const conversionsRaw = parseInputAsNumber(variantData.conversions); // Generic

        let openRate = 'N/A', clickThroughRate = 'N/A', conversionRate = 'N/A';
        let totalRevenue = 'N/A', srrRate = 'N/A', mrrRate = 'N/A', averageIpp = 'N/A';
        
        let openRateSig: SignificanceInfo = { pValue: null, isSignificant: false };
        let clickThroughRateSig: SignificanceInfo = { pValue: null, isSignificant: false };
        let conversionRateSig: SignificanceInfo = { pValue: null, isSignificant: false };

        const controlSendsRaw = controlVariantData ? parseInputAsNumber(controlVariantData.sends) : null;
        const controlUniqueOpensRaw = controlVariantData ? parseInputAsNumber(controlVariantData.uniqueOpens) : null;
        const controlUniqueClicksRaw = controlVariantData ? parseInputAsNumber(controlVariantData.uniqueClicks) : null;
        const controlConversionsRaw = controlVariantData ? parseInputAsNumber(controlVariantData.conversions) : null;

        // Engagement Metrics
        if (currentChannel === 'email' && sendsRaw !== null && uniqueOpensRaw !== null) {
            const sigResult = (controlVariantData && controlSendsRaw !== null && controlUniqueOpensRaw !== null && variantData.id !== controlVariantData.id)
                ? calculateRateAndSignificance(controlUniqueOpensRaw, controlSendsRaw, uniqueOpensRaw, sendsRaw)
                : calculateRateAndSignificance(uniqueOpensRaw, sendsRaw, uniqueOpensRaw, sendsRaw); 
            openRate = sigResult.rate2; 
            if (variantData.id !== controlVariantData?.id) {
                 openRateSig = { pValue: sigResult.pValue, isSignificant: sigResult.isSignificant };
            }
        }
        if (sendsRaw !== null && uniqueClicksRaw !== null) {
            const sigResult = (controlVariantData && controlSendsRaw !== null && controlUniqueClicksRaw !== null && variantData.id !== controlVariantData.id)
                ? calculateRateAndSignificance(controlUniqueClicksRaw, controlSendsRaw, uniqueClicksRaw, sendsRaw)
                : calculateRateAndSignificance(uniqueClicksRaw, sendsRaw, uniqueClicksRaw, sendsRaw);
            clickThroughRate = sigResult.rate2;
             if (variantData.id !== controlVariantData?.id) {
                clickThroughRateSig = { pValue: sigResult.pValue, isSignificant: sigResult.isSignificant };
            }
        }

        // Commercial Metrics
        if (commercialIncluded) {
            if (mode1066Active) {
                srrRate = formatPercentageInput(variantData.srrRateInput);
                mrrRate = formatPercentageInput(variantData.mrrRateInput);
                averageIpp = formatAsCurrency(variantData.averageIppInput, selectedCurrency);
                // No significance testing for 1066 direct inputs
            } else { // Generic commercial
                if (uniqueClicksRaw !== null && uniqueClicksRaw > 0 && conversionsRaw !== null) {
                     const sigResult = (controlVariantData && controlUniqueClicksRaw !== null && controlUniqueClicksRaw > 0 && controlConversionsRaw !== null && variantData.id !== controlVariantData.id)
                        ? calculateRateAndSignificance(controlConversionsRaw, controlUniqueClicksRaw, conversionsRaw, uniqueClicksRaw)
                        : calculateRateAndSignificance(conversionsRaw, uniqueClicksRaw, conversionsRaw, uniqueClicksRaw);
                    conversionRate = sigResult.rate2;
                    if (variantData.id !== controlVariantData?.id) {
                        conversionRateSig = { pValue: sigResult.pValue, isSignificant: sigResult.isSignificant };
                    }
                } else if (uniqueClicksRaw === 0) {
                    conversionRate = 'N/A (No Clicks)';
                }
                totalRevenue = calculateTotalValue(variantData.conversions, variantData.averageValuePerConversion, selectedCurrency);
            }
        }
    return {
        sendsRaw, uniqueOpensRaw, uniqueClicksRaw, conversionsRaw,
        openRate, clickThroughRate, conversionRate, totalRevenue, srrRate, mrrRate, averageIpp,
        openRateSig, clickThroughRateSig, conversionRateSig
    };
  }, []);

  const allVariantRates: RateData[] = useMemo(() => {
    const controlVData = variantsData.find(v => v.id === controlVariantId);
    return variantsData.map(variant => ({
      id: variant.id,
      name: variant.name,
      ...getVariantCalculatedRates(variant, controlVData, channel, currency, is1066ModeActive, includeCommercial),
    }));
  }, [variantsData, controlVariantId, channel, currency, getVariantCalculatedRates, is1066ModeActive, includeCommercial]);

  const parseMetricValue = (valueStr: string | undefined): number | null => {
    if (valueStr === 'N/A' || valueStr === undefined || valueStr.trim() === '' || valueStr.includes('(No Clicks)') || valueStr.includes('(No SRR Base)')) return null;
    const num = parseFloat(String(valueStr).replace(/[^0-9.,-]+/g,"").replace(',', '.'));
    return isNaN(num) ? null : num;
  };

  const determineKpiWinner = (
    rates: RateData[],
    ctrlId: string,
    kpiField: keyof Omit<RateData, 'id' | 'name' | 'sendsRaw' | 'uniqueOpensRaw' | 'uniqueClicksRaw' | 'conversionsRaw' | 'openRateSig' | 'clickThroughRateSig' | 'conversionRateSig'>,
    kpiDisplayName: string,
    higherIsBetter: boolean,
    significanceField?: keyof Pick<RateData, 'openRateSig' | 'clickThroughRateSig' | 'conversionRateSig'>
  ): KpiWinnerInfo => {
    const controlRateData = rates.find(r => r.id === ctrlId);
    if (!controlRateData) {
      return { winnerVariantName: 'N/A', winnerKpiValue: 'N/A', controlKpiValue: 'N/A', performanceChangePercent: null, isConclusive: false, kpiDisplayName, significance: {pValue: null, isSignificant: false} };
    }

    let winner = controlRateData;
    let bestValNumeric = parseMetricValue(controlRateData[kpiField as keyof RateData] as string);

    rates.forEach(variantRate => {
      const variantValNumeric = parseMetricValue(variantRate[kpiField as keyof RateData] as string);
      if (variantValNumeric === null) return; 

      if (bestValNumeric === null || (higherIsBetter ? variantValNumeric > bestValNumeric : variantValNumeric < bestValNumeric)) {
        bestValNumeric = variantValNumeric;
        winner = variantRate;
      } else if (variantValNumeric === bestValNumeric && variantRate.id !== ctrlId && winner.id === ctrlId) {
        winner = variantRate;
      }
    });
    
    const controlValNumeric = parseMetricValue(controlRateData[kpiField as keyof RateData] as string);
    const winnerValNumeric = parseMetricValue(winner[kpiField as keyof RateData] as string); 

    let performanceChange: number | null = null;
    if (controlValNumeric !== null && winnerValNumeric !== null && controlValNumeric !== 0 && winner.id !== ctrlId) {
      performanceChange = ((winnerValNumeric - controlValNumeric) / Math.abs(controlValNumeric)) * 100;
    } else if (winnerValNumeric !== null && controlValNumeric !== null && winner.id === ctrlId && controlValNumeric === winnerValNumeric) {
      const challengersBetter = rates.filter(r => r.id !== ctrlId).some(challenger => {
        const challengerVal = parseMetricValue(challenger[kpiField as keyof RateData] as string);
        return challengerVal !== null && (higherIsBetter ? challengerVal > controlValNumeric : challengerVal < controlValNumeric);
      });
      if (!challengersBetter) performanceChange = 0; 
    }
    
    const significanceData = significanceField && winner.id !== ctrlId ? winner[significanceField] as SignificanceInfo : undefined;

    return {
      winnerVariantName: winner.name,
      winnerKpiValue: winner[kpiField as keyof RateData] as string,
      controlKpiValue: controlRateData[kpiField as keyof RateData] as string,
      performanceChangePercent: performanceChange,
      isConclusive: winnerValNumeric !== null, 
      kpiDisplayName,
      significance: significanceData
    };
  };

  const generateTestConclusion = useCallback((): TestConclusionData => {
    const summaryElements: React.ReactNode[] = [];
    let commercialWinnerInfo: KpiWinnerInfo | null = null;
    let engagementWinnerInfo: KpiWinnerInfo | null = null;
    let overallWinnerVariantName: string | null = null;
    let winningKpiForHighlight: KpiWinnerInfo | null = null;
    let isFlatResult = false;
    let winningKpiPerformanceChange: number | null = null;

    const controlName = variantsData.find(v => v.id === controlVariantId)?.name;

    const renderSignificanceText = (sigInfo?: SignificanceInfo) => {
        if (!sigInfo || sigInfo.pValue === null) return null;
        const confidence = (1 - sigInfo.pValue) * 100;
        if (sigInfo.isSignificant) {
            return <span className="text-green-600 dark:text-green-400 font-semibold"> (This difference is statistically significant, with {confidence.toFixed(1)}% confidence that it's a real effect.)</span>;
        }
        return <span className="text-gray-500 dark:text-gray-400"> (This difference is not statistically significant. We only have {confidence.toFixed(1)}% confidence that it's a real effect, so it could be due to random chance.)</span>;
    };


    if (includeCommercial && is1066ModeActive) {
        const ippKpiInfo = determineKpiWinner(allVariantRates, controlVariantId, 'averageIpp', `Average IPP (${currencySymbols[currency]})`, true); 
        const srrKpiInfo = determineKpiWinner(allVariantRates, controlVariantId, 'srrRate', 'SRR (%)', true);
        const mrrKpiInfo = determineKpiWinner(allVariantRates, controlVariantId, 'mrrRate', 'MRR (%)', true);

        if (ippKpiInfo.isConclusive && parseMetricValue(ippKpiInfo.winnerKpiValue) !== null) {
            commercialWinnerInfo = ippKpiInfo; 
            winningKpiForHighlight = ippKpiInfo;
        } else if (srrKpiInfo.isConclusive && parseMetricValue(srrKpiInfo.winnerKpiValue) !== null) {
            commercialWinnerInfo = srrKpiInfo;
            if (!winningKpiForHighlight) winningKpiForHighlight = srrKpiInfo;
        } else if (mrrKpiInfo.isConclusive && parseMetricValue(mrrKpiInfo.winnerKpiValue) !== null) {
            commercialWinnerInfo = mrrKpiInfo;
            if (!winningKpiForHighlight) winningKpiForHighlight = mrrKpiInfo;
        }
        
        summaryElements.push(<p key="1066-intro" className="font-semibold">1066 Mode Commercial Analysis (Direct Comparison):</p>);
        if (ippKpiInfo.isConclusive) {
             summaryElements.push(<p key="ipp-sum">Avg. IPP: <strong>{ippKpiInfo.winnerVariantName}</strong> at {ippKpiInfo.winnerKpiValue}.</p>);
        } else summaryElements.push(<p key="ipp-sum-inconclusive">Avg. IPP analysis inconclusive.</p>);
        
        if (srrKpiInfo.isConclusive) {
            summaryElements.push(<p key="srr-sum">SRR (%): <strong>{srrKpiInfo.winnerVariantName}</strong> at {srrKpiInfo.winnerKpiValue}.</p>);
        } else summaryElements.push(<p key="srr-sum-inconclusive">SRR (%) analysis inconclusive.</p>);

        if (mrrKpiInfo.isConclusive) {
            summaryElements.push(<p key="mrr-sum">MRR (%): <strong>{mrrKpiInfo.winnerVariantName}</strong> at {mrrKpiInfo.winnerKpiValue}.</p>);
        } else summaryElements.push(<p key="mrr-sum-inconclusive">MRR (%) analysis inconclusive.</p>);
        
        if (!commercialWinnerInfo && !ippKpiInfo.isConclusive && !srrKpiInfo.isConclusive && !mrrKpiInfo.isConclusive ) {
            summaryElements.push(<p key="1066-comm-inconclusive">Overall 1066 commercial analysis inconclusive due to missing data for all key metrics.</p>);
        }

    } else if (includeCommercial) { 
      const revenueKpiInfo = determineKpiWinner(allVariantRates, controlVariantId, 'totalRevenue', `Total Revenue (${currencySymbols[currency]})`, true);
      if (revenueKpiInfo.isConclusive && parseMetricValue(revenueKpiInfo.winnerKpiValue) !== null) {
        commercialWinnerInfo = revenueKpiInfo;
        winningKpiForHighlight = revenueKpiInfo;
      } else {
        const conversionRateKpiName = `${conversionMetricName || 'Conversions'} Rate`; // Suffix removed for cleaner display name
        const crKpiInfo = determineKpiWinner(allVariantRates, controlVariantId, 'conversionRate', conversionRateKpiName, true, 'conversionRateSig');
        if (crKpiInfo.isConclusive && parseMetricValue(crKpiInfo.winnerKpiValue) !== null) {
          commercialWinnerInfo = crKpiInfo;
          if (!winningKpiForHighlight) winningKpiForHighlight = crKpiInfo;
        }
      }

      if (commercialWinnerInfo?.isConclusive) {
        summaryElements.push(
          <p key="comm-winner">
            For commercial performance, focusing on <strong>{commercialWinnerInfo.kpiDisplayName}</strong>,
            <strong> {commercialWinnerInfo.winnerVariantName}</strong> was the top performer achieving <strong>{commercialWinnerInfo.winnerKpiValue}</strong>.
            {commercialWinnerInfo.performanceChangePercent !== null && commercialWinnerInfo.winnerVariantName !== controlName && (
              <>
                {' '}This represented a 
                <strong className={commercialWinnerInfo.performanceChangePercent > 0 ? "text-green-600 dark:text-green-400" : commercialWinnerInfo.performanceChangePercent < 0 ? "text-red-600 dark:text-red-400" : ""}>
                  {commercialWinnerInfo.performanceChangePercent > 0 ? '+' : ''}{commercialWinnerInfo.performanceChangePercent.toFixed(1)}% change
                </strong> compared to the Control's {commercialWinnerInfo.controlKpiValue}.
                {commercialWinnerInfo.winnerVariantName !== controlName && commercialWinnerInfo.kpiDisplayName.toLowerCase().includes("rate") && renderSignificanceText(commercialWinnerInfo.significance)}
              </>
            )}
             {commercialWinnerInfo.performanceChangePercent === 0 && commercialWinnerInfo.winnerVariantName === controlName && (
              <>
                {' '}The Control variant performed best or was not significantly outperformed by any challenger on this KPI.
              </>
            )}
          </p>
        );
      } else {
        summaryElements.push(<p key="comm-inconclusive">Commercial performance analysis based on {commercialWinnerInfo?.kpiDisplayName || 'commercial metrics'} was inconclusive due to missing data.</p>);
      }
    }

    const ctrKpiInfo = determineKpiWinner(allVariantRates, controlVariantId, 'clickThroughRate', 'Click-Through Rate (CTR)', true, 'clickThroughRateSig');
    const orKpiInfo = channel === 'email' ? determineKpiWinner(allVariantRates, controlVariantId, 'openRate', 'Open Rate (OR)', true, 'openRateSig') : null;

    const isCtrConclusive = ctrKpiInfo.isConclusive && parseMetricValue(ctrKpiInfo.winnerKpiValue) !== null;
    const isOrConclusive = orKpiInfo && orKpiInfo.isConclusive && parseMetricValue(orKpiInfo.winnerKpiValue) !== null;

    if (primaryEngagementMetric === 'openRate' && channel === 'email') {
        if (isOrConclusive) {
            engagementWinnerInfo = orKpiInfo;
        } else if (isCtrConclusive) {
            engagementWinnerInfo = ctrKpiInfo;
        }
    } else { // Default to CTR priority
        if (isCtrConclusive) {
            engagementWinnerInfo = ctrKpiInfo;
        } else if (isOrConclusive) {
            engagementWinnerInfo = orKpiInfo;
        }
    }
    
    if (engagementWinnerInfo && !winningKpiForHighlight) {
        winningKpiForHighlight = engagementWinnerInfo;
    }
    
    if (engagementWinnerInfo?.isConclusive) {
      const wasPrimaryMetricUsed = 
        (primaryEngagementMetric === 'openRate' && engagementWinnerInfo.kpiDisplayName.includes('Open Rate')) ||
        (primaryEngagementMetric === 'clickThroughRate' && engagementWinnerInfo.kpiDisplayName.includes('Click-Through Rate')) ||
        channel === 'sms';

      summaryElements.push(
        <p key="eng-winner">
          For engagement, based on the 
          <strong> {wasPrimaryMetricUsed ? 'primary metric ' : 'fallback metric '}{engagementWinnerInfo.kpiDisplayName}</strong>,
          <strong> {engagementWinnerInfo.winnerVariantName}</strong> led with <strong>{engagementWinnerInfo.winnerKpiValue}</strong>.
          {engagementWinnerInfo.performanceChangePercent !== null && engagementWinnerInfo.winnerVariantName !== controlName && (
            <>
              {' '}This was a 
              <strong className={engagementWinnerInfo.performanceChangePercent > 0 ? "text-green-600 dark:text-green-400" : engagementWinnerInfo.performanceChangePercent < 0 ? "text-red-600 dark:text-red-400" : ""}>
                {engagementWinnerInfo.performanceChangePercent > 0 ? '+' : ''}{engagementWinnerInfo.performanceChangePercent.toFixed(1)}% change
              </strong> over the Control's {engagementWinnerInfo.controlKpiValue}.
              {engagementWinnerInfo.winnerVariantName !== controlName && renderSignificanceText(engagementWinnerInfo.significance)}
            </>
          )}
           {engagementWinnerInfo.performanceChangePercent === 0 && engagementWinnerInfo.winnerVariantName === controlName && (
              <>
                {' '}The Control variant performed best or was not significantly outperformed by any challenger on this KPI.
              </>
            )}
        </p>
      );
    } else {
      summaryElements.push(<p key="eng-inconclusive">Engagement performance analysis based on {engagementWinnerInfo?.kpiDisplayName || 'engagement metrics'} was inconclusive due to missing data.</p>);
    }

    if (winningKpiForHighlight) {
      overallWinnerVariantName = winningKpiForHighlight.winnerVariantName;
      winningKpiPerformanceChange = winningKpiForHighlight.performanceChangePercent;
      const isTestableKpi = // Logic to check if KPI is OR, CTR, Generic CR
        winningKpiForHighlight.kpiDisplayName.toLowerCase().includes("rate") && 
        !(is1066ModeActive && includeCommercial && 
          (winningKpiForHighlight.kpiDisplayName.includes("SRR") || winningKpiForHighlight.kpiDisplayName.includes("MRR")));

      if (overallWinnerVariantName === controlName) {
         // Check if any challenger significantly outperformed the control on this KPI
        const challengerWonSignificantly = allVariantRates.filter(v => v.id !== controlVariantId).some(challengerRate => {
            if (!winningKpiForHighlight) return false;
            // Determine which significance info to use based on the KPI
            let sigInfo: SignificanceInfo | undefined;
            if (winningKpiForHighlight.kpiDisplayName.includes('Open Rate')) sigInfo = challengerRate.openRateSig;
            else if (winningKpiForHighlight.kpiDisplayName.includes('CTR')) sigInfo = challengerRate.clickThroughRateSig;
            else if (winningKpiForHighlight.kpiDisplayName.includes(conversionMetricName) && !is1066ModeActive && !winningKpiForHighlight.kpiDisplayName.includes('Revenue')) sigInfo = challengerRate.conversionRateSig;
            
            const challengerValue = parseMetricValue((challengerRate as any)[winningKpiForHighlight.kpiDisplayName.toLowerCase().replace(/\s+/g, '').replace('(or)','openrate').replace('(ctr)','clickthroughrate')]); // simplified field access
            const controlValue = parseMetricValue(winningKpiForHighlight.controlKpiValue);
            
            return sigInfo?.isSignificant && challengerValue !== null && controlValue !== null && challengerValue > controlValue;
        });

        if (!challengerWonSignificantly && (winningKpiPerformanceChange === null || (winningKpiPerformanceChange !== null && Math.abs(winningKpiPerformanceChange) < 2.0))) {
             isFlatResult = true;
        }
        if (isTestableKpi && winningKpiForHighlight.significance && !winningKpiForHighlight.significance.isSignificant && winningKpiForHighlight.winnerVariantName === controlName) {
            // If control won, but its "win" (which means no challenger beat it significantly) is itself not a significant outperformance of a specific challenger
            // This case might be redundant with the one above.
            // isFlatResult = true; // Potentially refine this
        }

      } else { // Challenger is the winner based on raw metric
         isFlatResult = isTestableKpi && winningKpiForHighlight.significance ? !winningKpiForHighlight.significance.isSignificant : (winningKpiPerformanceChange !== null && Math.abs(winningKpiPerformanceChange) < 2.0); 
      }
    }


    if (commercialWinnerInfo?.isConclusive && engagementWinnerInfo?.isConclusive) {
      if (commercialWinnerInfo.winnerVariantName === engagementWinnerInfo.winnerVariantName) {
        summaryElements.push(
          <p key="bp-aligned" className="mt-2 font-semibold">
            This indicates a strong overall performance for <strong>{commercialWinnerInfo.winnerVariantName}</strong>.
            {commercialWinnerInfo.winnerVariantName !== controlName && (commercialWinnerInfo.significance?.isSignificant || engagementWinnerInfo.significance?.isSignificant) && " The improvement appears statistically significant for at least one key metric."}
          </p>
        );
      } else {
        summaryElements.push(
          <p key="bp-diverged" className="mt-2">
            <strong>Bigger Picture:</strong> This presents a nuanced picture. While <strong>{commercialWinnerInfo.winnerVariantName}</strong> demonstrated superior {commercialWinnerInfo.kpiDisplayName.toLowerCase()},
            <strong> {engagementWinnerInfo.winnerVariantName}</strong> was more effective at {engagementWinnerInfo.kpiDisplayName.toLowerCase()}.
            The optimal choice depends on the primary objective of this test and the statistical significance of these differences (where applicable).
          </p>
        );
      }
    } else if (summaryElements.length === 0 || (!commercialWinnerInfo?.isConclusive && !engagementWinnerInfo?.isConclusive && !(includeCommercial && is1066ModeActive && (commercialWinnerInfo || engagementWinnerInfo)))) {
      if(!(includeCommercial && is1066ModeActive && (summaryElements.some(el => (el as React.ReactElement)?.key?.toString().includes('-sum') && !(el as React.ReactElement)?.key?.toString().includes('-inconclusive'))))) {
        return { summaryText: <p>The test analysis is inconclusive due to missing or N/A data across key metrics.</p>, overallWinnerVariantName: null, isFlatResult: false, winningKpiPerformanceChange: null };
      }
    }
    
    if (isFlatResult && overallWinnerVariantName) { 
         summaryElements.push(
            <p key="bp-flat" className="mt-2 font-semibold text-amber-700 dark:text-amber-400">
                Overall, the test results appear flat. While <strong>{overallWinnerVariantName}</strong> had the best performance on the primary KPI ({winningKpiForHighlight?.kpiDisplayName}), the difference was not statistically significant (where applicable) or the margin was negligible.
            </p>
        );
    }


    return { summaryText: <div className="space-y-2 text-sm">{summaryElements}</div>, overallWinnerVariantName, isFlatResult, winningKpiPerformanceChange };
  }, [allVariantRates, controlVariantId, channel, includeCommercial, conversionMetricName, currency, variantsData, is1066ModeActive, primaryEngagementMetric]);


  const handleNextStep = useCallback(() => {
    if (currentStep === totalSteps - 1) { // Step 3 -> 4 transition
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'run_test_analysis', {
          'test_channel': channel,
          'include_commercial': includeCommercial,
          'variant_count': variantsData.length,
          'is_1066_mode': is1066ModeActive,
        });
      }

      setIsAnalyzing(true);
      
      const analysisSteps = [
        { text: 'Initializing analysis...', delay: 0 },
        { text: 'Parsing variant data...', delay: 700 },
        { text: 'Calculating engagement rates...', delay: 1500 },
        { text: 'Assessing statistical significance...', delay: 2300 },
      ];
      
      if (includeCommercial) {
        analysisSteps.push({ text: 'Evaluating commercial impact...', delay: 3100 });
      }

      analysisSteps.push({ text: 'Generating final conclusion...', delay: 3800 });

      analysisSteps.forEach(step => {
        setTimeout(() => {
          setAnalysisProgressText(step.text);
        }, step.delay);
      });
      
      const totalDelay = analysisSteps[analysisSteps.length - 1].delay + 1000;

      setTimeout(() => {
        setTestConclusion(generateTestConclusion());
        setIsAnalyzing(false);
        setCurrentStep(totalSteps);
      }, totalDelay);

    } else {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  }, [currentStep, generateTestConclusion, includeCommercial, channel, variantsData.length, is1066ModeActive]);


  const handlePrevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const addVariant = useCallback(() => {
    setVariantsData(prev => [...prev, createNewVariant(nextVariantNumericId)]);
    setNextVariantNumericId(prev => prev + 1);
  }, [nextVariantNumericId]);

  const removeVariant = useCallback((idToRemove: string) => {
    if (variantsData.length <= 2) return; 
    setVariantsData(prev => {
      const newVariants = prev.filter(v => v.id !== idToRemove);
      if (idToRemove === controlVariantId && newVariants.length > 0) {
        setControlVariantId(newVariants[0].id); 
      }
      return newVariants;
    });
  }, [variantsData.length, controlVariantId]);

  const updateVariantName = useCallback((id: string, newName: string) => {
    setVariantsData(prev => prev.map(v => v.id === id ? { ...v, name: newName } : v));
  }, []);

  const updateVariantMetric = useCallback((id: string, field: keyof VariantMetrics, value: string) => {
    setVariantsData(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  }, []);

  const setAsControl = useCallback((id: string) => {
    setControlVariantId(id);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey && event.shiftKey && (event.key === 'D' || event.key === 'd')) {
            event.preventDefault();
            setIsDevToolsVisible(prev => !prev);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const button = backToHubButtonRef.current;
    const handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        setIsDevToolsVisible(prev => !prev);
    };
    if (button) {
        button.addEventListener('contextmenu', handleContextMenu);
    }
    return () => {
        if (button) {
            button.removeEventListener('contextmenu', handleContextMenu);
        }
    };
  }, [backToHubButtonRef]);

  const generateRandomNumber = (min: number, max: number, isFloat: boolean = false): number => {
    const num = Math.random() * (max - min) + min;
    return isFloat ? num : Math.floor(num);
  };

  const handleFillWithRandomData = useCallback(() => {
    const newChannel = Math.random() < 0.5 ? 'email' : 'sms';
    setChannel(newChannel);
    if (newChannel === 'sms') {
      setPrimaryEngagementMetric('clickThroughRate');
    }

    const newIncludeCommercial = Math.random() < 0.7; 
    setIncludeCommercial(newIncludeCommercial);
    setCurrency('GBP');

    if (newIncludeCommercial && !is1066ModeActive) {
        const devMetricNames = ["SRR", "MRR", "IPP", "Sales", "Leads", "Subscriptions"];
        const randomMetricName = devMetricNames[generateRandomNumber(0, devMetricNames.length -1)];
        setConversionMetricName(randomMetricName);
        if (predefinedMetricNames.includes(randomMetricName as MetricNameOption)) {
            setMetricNameSelectionOption(randomMetricName as MetricNameOption);
        } else {
            setMetricNameSelectionOption('custom');
        }
    }

    const updatedVariantsData = variantsData.map(variant => {
        const sends = generateRandomNumber(1000, 200000); 
        let uniqueOpens = 0;
        if (newChannel === 'email') {
            uniqueOpens = generateRandomNumber(Math.floor(sends * 0.2), Math.floor(sends * 0.7)); 
            uniqueOpens = Math.min(sends, uniqueOpens); 
        }

        let uniqueClicks = 0;
        if (newChannel === 'email') {
            const maxClicks = uniqueOpens > 0 ? uniqueOpens : sends; 
            uniqueClicks = generateRandomNumber(Math.floor(maxClicks * 0.1), Math.floor(maxClicks * 0.5)); 
            uniqueClicks = Math.min(maxClicks, uniqueClicks);
        } else { 
            uniqueClicks = generateRandomNumber(Math.floor(sends * 0.02), Math.floor(sends * 0.25)); 
            uniqueClicks = Math.min(sends, uniqueClicks);
        }

        let baseReturn: Partial<Pick<VariantMetrics, 'conversions' | 'averageValuePerConversion' | 'srrRateInput' | 'mrrRateInput' | 'averageIppInput'>> = {};

        if (newIncludeCommercial) {
            if (is1066ModeActive) {
                baseReturn = {
                    srrRateInput: generateRandomNumber(50, 90, true).toFixed(1),
                    mrrRateInput: generateRandomNumber(40, 85, true).toFixed(1),
                    averageIppInput: generateRandomNumber(5, 50, true).toFixed(2),
                };
            } else {
                 let conversions = 0;
                 let averageValuePerConversion = 0;
                 if (uniqueClicks > 0) {
                    conversions = generateRandomNumber(Math.floor(uniqueClicks * 0.05), Math.floor(uniqueClicks * 0.30)); 
                    conversions = Math.min(uniqueClicks, conversions);
                 }
                 averageValuePerConversion = generateRandomNumber(10, 500, true);
                 baseReturn = {
                    conversions: String(conversions),
                    averageValuePerConversion: averageValuePerConversion > 0 ? averageValuePerConversion.toFixed(2) : '',
                 };
            }
        }

        return {
            ...variant, 
            sends: String(sends),
            uniqueOpens: String(uniqueOpens),
            uniqueClicks: String(uniqueClicks),
            ...baseReturn,
        };
    });
    setVariantsData(updatedVariantsData as Variant[]);
  }, [variantsData, is1066ModeActive]); 

  const handleFillWithFlatData = useCallback(() => {
    setChannel('email');
    setIncludeCommercial(true);
    setCurrency('GBP');

    if (!is1066ModeActive) {
        const flatMetricNames = ["SRR", "MRR", "IPP"];
        const randomFlatMetricName = flatMetricNames[generateRandomNumber(0, flatMetricNames.length -1)];
        setConversionMetricName(randomFlatMetricName);
        setMetricNameSelectionOption(randomFlatMetricName as MetricNameOption);
    }
    
    let currentVariants = [...variantsData];
    if (currentVariants.length < 3) {
      const numToAdd = 3 - currentVariants.length;
      let nextId = nextVariantNumericId;
      for (let i = 0; i < numToAdd; i++) {
        currentVariants.push(createNewVariant(nextId));
        nextId++;
      }
      setNextVariantNumericId(nextId);
    } else if (currentVariants.length > 3) {
      currentVariants = currentVariants.slice(0, 3);
    }
    
    const controlSends = 50000;
    const controlOpensRatio = 0.30; 
    const controlClicksRatioOfOpens = 0.10; 

    const controlSrrRate = 75.0;
    const controlMrrRate = 80.0; 
    const controlAverageIpp = 20.00; 

    const controlGenericConversionRateOfClicks = 0.05; 
    const controlGenericAOV = 20;

    const updatedVariantsData = currentVariants.map((variant, index) => {
        let challengerData: Partial<Pick<VariantMetrics, 'conversions' | 'averageValuePerConversion' | 'srrRateInput' | 'mrrRateInput' | 'averageIppInput'>> = {};
        
        const sendsVariation = index === 0 ? 0 : generateRandomNumber(-2000, 2000); 
        const challengerSends = controlSends + sendsVariation;
        const challengerOpens = Math.round(challengerSends * controlOpensRatio + generateRandomNumber(-500, 500));
        const challengerClicks = Math.round(challengerOpens * controlClicksRatioOfOpens + generateRandomNumber(-150, 150));


        if (is1066ModeActive) {
            challengerData = {
                srrRateInput: (controlSrrRate + generateRandomNumber(-1, 1, true)).toFixed(1),
                mrrRateInput: (controlMrrRate + generateRandomNumber(-1, 1, true)).toFixed(1),
                averageIppInput: (controlAverageIpp + generateRandomNumber(-0.5, 0.5, true)).toFixed(2),
            };
        } else {
            const challengerGenericConversions = Math.round(challengerClicks * controlGenericConversionRateOfClicks + generateRandomNumber(-30, 30));
            const challengerGenericAOV = controlGenericAOV + generateRandomNumber(-1, 1, true);
            challengerData = {
                conversions: String(Math.max(0, challengerGenericConversions)),
                averageValuePerConversion: String(Math.max(0.01, challengerGenericAOV).toFixed(2)),
            };
        }
        
        let namePrefix = index === 0 ? "Control" : `Challenger ${index}`;

        return {
            ...variant,
            name: `${namePrefix} (Flat Sim)`,
            sends: String(Math.max(100, challengerSends)), 
            uniqueOpens: String(Math.max(0, Math.min(challengerOpens, challengerSends))),
            uniqueClicks: String(Math.max(0, Math.min(challengerClicks, challengerOpens > 0 ? challengerOpens : challengerSends))),
            ...challengerData
        };
    });
    setVariantsData(updatedVariantsData as Variant[]);
    setControlVariantId(updatedVariantsData[0].id); 
  }, [variantsData, nextVariantNumericId, is1066ModeActive]);


  const colorSchemeClass = theme === 'light' ? '[color-scheme:light]' : '[color-scheme:dark]';
  const inputClasses = `mt-1 block w-full px-3 py-2 bg-crm-background dark:bg-crm-dm-background border border-crm-border dark:border-crm-dm-border rounded-md shadow-sm focus:outline-none focus:ring-crm-accent focus:border-crm-accent sm:text-sm transition-colors duration-300 ${colorSchemeClass}`;
  const labelClasses = "block text-sm font-medium text-crm-text-body dark:text-crm-dm-text-body transition-colors duration-300";
  const cardClasses = "bg-crm-card dark:bg-crm-dm-card p-6 sm:p-8 rounded-xl shadow-xl dark:shadow-2xl transition-colors duration-300";
  const buttonClasses = "bg-gradient-to-r from-fuchsia-500 via-sky-400 to-violet-500 text-crm-button-text font-semibold py-2.5 px-4 rounded-lg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-crm-accent transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed";
  const secondaryButtonClasses = "bg-gray-200 dark:bg-gray-600 text-crm-text-body dark:text-crm-dm-text-body font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-crm-accent transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed";
  const tertiaryButtonClasses = "text-sm px-3 py-1.5 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-crm-accent focus:ring-offset-1";
  const checkboxLabelClasses = "ml-2 text-sm text-crm-text-body dark:text-crm-dm-text-body transition-colors duration-300 cursor-pointer";


  const getPerformanceRelativeToControl = (
    controlValueStr: string | undefined, 
    challengerValueStr: string | undefined,
    higherIsBetter: boolean = true
  ): React.ReactNode => {
    const controlVal = parseMetricValue(controlValueStr);
    const challengerVal = parseMetricValue(challengerValueStr);

    if (controlVal === null || challengerVal === null) return null;
    if (controlVal === challengerVal) return <span className="text-xs text-gray-500 dark:text-gray-400"> (No change)</span>;

    let diffPercentage: number | null = null;
    if (controlVal !== 0) {
      diffPercentage = ((challengerVal - controlVal) / Math.abs(controlVal)) * 100;
    }

    const isBetter = higherIsBetter ? challengerVal > controlVal : challengerVal < controlVal;
    const colorClass = isBetter ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400";
    
    if (diffPercentage !== null) {
      return <span className={`text-xs ${colorClass}`}> ({diffPercentage >= 0 ? '+' : ''}{diffPercentage.toFixed(1)}%)</span>;
    } else if (challengerVal !== controlVal) { 
       return <span className={`text-xs ${colorClass}`}> ({challengerVal > controlVal ? 'Higher' : 'Lower'})</span>;
    }
    return null;
  };

  const renderSignificanceIndicator = (sigInfo?: SignificanceInfo, isControlCard: boolean = false) => {
    if (isControlCard || !sigInfo || sigInfo.pValue === null) return null;
    
    const confidence = (1 - sigInfo.pValue) * 100;
    let text: string;
    let title: string;
    let colorClass: string;

    if (sigInfo.isSignificant) {
        text = `✓ Significant (${confidence.toFixed(1)}% Conf.)`;
        title = `Statistically Significant. We are ${confidence.toFixed(1)}% confident that the observed difference is real and not due to random chance. (p=${sigInfo.pValue.toFixed(3)})`;
        colorClass = "text-green-500 dark:text-green-400";
    } else {
        text = `~ Not Sig. (${confidence.toFixed(1)}% Conf.)`;
        title = `Not Statistically Significant. We only have ${confidence.toFixed(1)}% confidence that the observed difference is real; it could be due to random chance. (p=${sigInfo.pValue.toFixed(3)})`;
        colorClass = "text-gray-500 dark:text-gray-400";
    }
    
    return (
        <span className={`ml-1 text-xs font-medium ${colorClass}`} title={title}>
            {text}
        </span>
    );
  };


  const renderVariantInputs = (variant: Variant, calculatedRates: RateData | undefined, currentStepForInputs: 2 | 3) => {
    const isControl = variant.id === controlVariantId;
    return (
      <div key={variant.id} className={`space-y-4 p-4 border rounded-lg ${isControl ? 'border-crm-accent dark:border-fuchsia-400 shadow-md' : 'border-crm-border dark:border-crm-dm-border'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <input 
            type="text" 
            value={variant.name} 
            onChange={e => updateVariantName(variant.id, e.target.value)} 
            className={`${inputClasses} flex-grow py-1.5 text-base font-semibold`}
            aria-label={`Variant ${variant.name} name`}
          />
           <div className="flex items-center gap-2 flex-shrink-0">
            <button 
              onClick={() => setAsControl(variant.id)} 
              disabled={isControl}
              className={`${tertiaryButtonClasses} ${isControl ? 'bg-crm-accent text-white cursor-default' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            >
              {isControl ? 'Control' : 'Set as Control'}
            </button>
            {variantsData.length > 2 && (
              <button onClick={() => removeVariant(variant.id)} className={`${tertiaryButtonClasses} bg-red-500 text-white hover:bg-red-600`}>
                Remove
              </button>
            )}
          </div>
        </div>

        {currentStepForInputs === 2 && ( // Engagement Metrics
          <>
            <div><label htmlFor={`sends-${variant.id}`} className={labelClasses}>Send Volume</label><input type="number" id={`sends-${variant.id}`} value={variant.sends} onChange={e => updateVariantMetric(variant.id, 'sends', e.target.value)} className={inputClasses} placeholder="e.g., 10000" min="0"/></div>
            {channel === 'email' && <div><label htmlFor={`opens-${variant.id}`} className={labelClasses}>Unique Opens</label><input type="number" id={`opens-${variant.id}`} value={variant.uniqueOpens} onChange={e => updateVariantMetric(variant.id, 'uniqueOpens', e.target.value)} className={inputClasses} placeholder="e.g., 1000" min="0"/></div>}
            <div><label htmlFor={`clicks-${variant.id}`} className={labelClasses}>Unique Clicks</label><input type="number" id={`clicks-${variant.id}`} value={variant.uniqueClicks} onChange={e => updateVariantMetric(variant.id, 'uniqueClicks', e.target.value)} className={inputClasses} placeholder="e.g., 100" min="0"/></div>
            {channel === 'email' && <p className="text-sm text-crm-text-muted dark:text-crm-dm-text-muted">Open Rate: {calculatedRates?.openRate || 'N/A'}</p>}
            <p className="text-sm text-crm-text-muted dark:text-crm-dm-text-muted">Click-Through Rate: {calculatedRates?.clickThroughRate || 'N/A'}</p>
          </>
        )}

        {currentStepForInputs === 3 && includeCommercial && (
          is1066ModeActive ? ( 
            <>
              <h4 className="text-sm font-semibold text-crm-accent dark:text-fuchsia-400 pt-2">1066 Metrics (Direct Input):</h4>
              <div><label htmlFor={`srrRateInput-${variant.id}`} className={labelClasses}>SRR (%)</label><input type="number" id={`srrRateInput-${variant.id}`} value={variant.srrRateInput} onChange={e => updateVariantMetric(variant.id, 'srrRateInput', e.target.value)} className={inputClasses} placeholder="e.g., 75" min="0" step="0.01"/></div>
              <div><label htmlFor={`mrrRateInput-${variant.id}`} className={labelClasses}>MRR (%)</label><input type="number" id={`mrrRateInput-${variant.id}`} value={variant.mrrRateInput} onChange={e => updateVariantMetric(variant.id, 'mrrRateInput', e.target.value)} className={inputClasses} placeholder="e.g., 60" min="0" step="0.01"/></div>
              <div><label htmlFor={`averageIppInput-${variant.id}`} className={labelClasses}>Average IPP ({currencySymbols[currency]})</label><input type="number" id={`averageIppInput-${variant.id}`} value={variant.averageIppInput} onChange={e => updateVariantMetric(variant.id, 'averageIppInput', e.target.value)} className={inputClasses} placeholder="e.g., 25.50" min="0" step="0.01"/></div>
            </>
          ) : ( // Generic Commercial Metrics
            <>
              <div><label htmlFor={`conversions-${variant.id}`} className={labelClasses}>Number of {conversionMetricName || 'Conversions'}</label><input type="number" id={`conversions-${variant.id}`} value={variant.conversions} onChange={e => updateVariantMetric(variant.id, 'conversions', e.target.value)} className={inputClasses} placeholder="e.g., 10" min="0"/></div>
              <div><label htmlFor={`aov-${variant.id}`} className={labelClasses}>Average Value per {conversionMetricName || 'Conversion'} ({currencySymbols[currency]})</label><input type="number" id={`aov-${variant.id}`} value={variant.averageValuePerConversion} onChange={e => updateVariantMetric(variant.id, 'averageValuePerConversion', e.target.value)} className={inputClasses} placeholder="e.g., 50.00" min="0" step="0.01"/></div>
              <p className="text-sm text-crm-text-muted dark:text-crm-dm-text-muted">{conversionMetricName || 'Conversion'} Rate (vs Clicks): {calculatedRates?.conversionRate || 'N/A'}</p>
              <p className="text-sm text-crm-text-muted dark:text-crm-dm-text-muted">Total Revenue: {calculatedRates?.totalRevenue || 'N/A'}</p>
            </>
          )
        )}
      </div>
    );
  };

  const formatNumberForDisplay = (valueStr: string | undefined | number | null) => {
    if (valueStr === 'N/A' || valueStr === undefined || valueStr === null || String(valueStr).trim() === '') return 'N/A';
    const num = parseFloat(String(valueStr));
    return isNaN(num) ? 'N/A' : num.toLocaleString();
  };

  const formatCurrencyForDisplay = (valueStr: string | undefined, selectedCurrency: Currency) => {
    if (valueStr === 'N/A' || valueStr === undefined || valueStr.trim() === '') return 'N/A';
    let numToFormat = valueStr;
    if (valueStr.includes(currencySymbols[selectedCurrency])) { 
        const parsed = parseMetricValue(valueStr);
        if(parsed === null) return 'N/A';
        numToFormat = parsed.toString(); 
    }

    const num = parseFloat(numToFormat); 
    if (isNaN(num)) return 'N/A';
    return num.toLocaleString(undefined, { style: 'currency', currency: selectedCurrency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };


  const AnalysisLoadingScreen: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-[250px] text-center transition-opacity duration-300">
      <svg className="animate-spin h-12 w-12 text-crm-accent mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <h3 className="text-xl font-semibold text-crm-text-heading dark:text-crm-dm-text-heading">Analyzing Test Data...</h3>
      <p className="text-crm-text-muted dark:text-crm-dm-text-muted mt-2 w-full h-6 transition-all duration-300">
        {analysisProgressText}
      </p>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: 
        return (
          <div className="space-y-6">
             <div>
              <label htmlFor="testName" className={labelClasses}>Test Name (Optional)</label>
              <input
                type="text"
                id="testName"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className={inputClasses}
                placeholder="e.g., Q3 Welcome Email Subject Line Test"
              />
            </div>
            <div>
              <label htmlFor="testType" className={labelClasses}>Test Type</label>
              <select id="testType" value={testType} onChange={(e) => setTestType(e.target.value as TestType)} className={inputClasses} disabled>
                <option value="engagement">Engagement Metrics</option>
              </select>
              <p className="mt-1 text-xs text-crm-text-muted dark:text-crm-dm-text-muted">Currently, only "Engagement Metrics" analysis is supported.</p>
            </div>
            <div>
              <label htmlFor="channel" className={labelClasses}>Channel</label>
              <select 
                id="channel" 
                value={channel} 
                onChange={(e) => {
                  const newChannel = e.target.value as Channel;
                  setChannel(newChannel);
                  if (newChannel === 'sms') {
                    setPrimaryEngagementMetric('clickThroughRate');
                  }
                }} 
                className={inputClasses}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            {channel === 'email' && (
              <div>
                <label className={labelClasses}>Primary Engagement Metric</label>
                <p className="mt-1 text-xs text-crm-text-muted dark:text-crm-dm-text-muted">Select the main KPI for engagement success.</p>
                <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="primaryEngagementMetric"
                      value="clickThroughRate"
                      checked={primaryEngagementMetric === 'clickThroughRate'}
                      onChange={() => setPrimaryEngagementMetric('clickThroughRate')}
                      className="h-4 w-4 text-crm-accent focus:ring-crm-accent border-crm-border dark:border-crm-dm-border bg-white dark:bg-slate-700"
                    />
                    <span className={checkboxLabelClasses}>Click-Through Rate (CTR)</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="primaryEngagementMetric"
                      value="openRate"
                      checked={primaryEngagementMetric === 'openRate'}
                      onChange={() => setPrimaryEngagementMetric('openRate')}
                      className="h-4 w-4 text-crm-accent focus:ring-crm-accent border-crm-border dark:border-crm-dm-border bg-white dark:bg-slate-700"
                    />
                    <span className={checkboxLabelClasses}>Open Rate (OR)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        );
      case 2: 
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {variantsData.map(variant => {
                const rates = allVariantRates.find(r => r.id === variant.id);
                return renderVariantInputs(variant, rates, 2);
              })}
            </div>
            <button onClick={addVariant} className={`${secondaryButtonClasses} w-full sm:w-auto ${variantsData.length >= 6 ? 'hidden' : ''}`}>
              + Add Variant
            </button>
          </div>
        );
      case 3: 
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <input type="checkbox" id="includeCommercialToggle" checked={includeCommercial} onChange={(e) => setIncludeCommercial(e.target.checked)} className={`h-5 w-5 appearance-none rounded focus:ring-crm-accent mr-2 border-2 border-crm-border bg-crm-background dark:border-crm-dm-border dark:bg-crm-dm-background checked:bg-crm-accent checked:border-crm-accent checked:[background-image:url("${CHECKMARK_SVG_DATA_URI}")] checked:bg-no-repeat checked:bg-center checked:[background-size:70%_70%]`} />
                    <label htmlFor="includeCommercialToggle" className={checkboxLabelClasses}>Include Commercial Impact Data?</label>
                </div>
                {is1066ModeActive && includeCommercial && (
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-sky-100 text-sky-700 dark:bg-sky-700 dark:text-sky-100">
                        1066 Mode Active
                    </span>
                )}
            </div>

            {includeCommercial && !is1066ModeActive && ( 
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                        <label htmlFor="conversionMetricNameSelect" className={labelClasses}>Commercial Metric Type</label>
                         <select 
                            id="conversionMetricNameSelect" 
                            value={metricNameSelectionOption} 
                            onChange={(e) => {
                                const newSelection = e.target.value as MetricNameOption | 'custom';
                                setMetricNameSelectionOption(newSelection);
                                if (newSelection !== 'custom') {
                                    setConversionMetricName(newSelection);
                                } else {
                                    setConversionMetricName(''); 
                                }
                            }} 
                            className={inputClasses}
                        >
                            {predefinedMetricNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                            <option value="custom">Custom...</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="currencySelect" className={labelClasses}>Currency</label>
                        <select 
                            id="currencySelect" 
                            value={currency} 
                            onChange={(e) => setCurrency(e.target.value as Currency)} 
                            className={inputClasses}
                        >
                            <option value="GBP">GBP (£) - Pound Sterling</option>
                            <option value="USD">USD ($) - US Dollar</option>
                            <option value="EUR">EUR (€) - Euro</option>
                        </select>
                    </div>
                    {metricNameSelectionOption === 'custom' && (
                         <div className="md:col-span-2">
                            <label htmlFor="customConversionMetricName" className={labelClasses}>Custom Metric Name</label>
                            <input 
                                type="text" 
                                id="customConversionMetricName" 
                                value={conversionMetricName} 
                                onChange={e => setConversionMetricName(e.target.value)} 
                                className={inputClasses} 
                                placeholder="e.g., Purchases, Sign-ups"
                            />
                        </div>
                    )}
                </div>
              </>
            )}
            {includeCommercial && is1066ModeActive && ( 
                 <div>
                    <label htmlFor="currencySelect1066" className={labelClasses}>Currency (for IPP)</label>
                    <select 
                        id="currencySelect1066" 
                        value={currency} 
                        onChange={(e) => setCurrency(e.target.value as Currency)} 
                        className={inputClasses}
                    >
                        <option value="GBP">GBP (£) - Pound Sterling</option>
                        <option value="USD">USD ($) - US Dollar</option>
                        <option value="EUR">EUR (€) - Euro</option>
                    </select>
                </div>
            )}

            {includeCommercial && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {variantsData.map(variant => {
                    const rates = allVariantRates.find(r => r.id === variant.id);
                    return renderVariantInputs(variant, rates, 3);
                  })}
                </div>
            )}
             {includeCommercial && (
                 <button onClick={addVariant} className={`${secondaryButtonClasses} w-full sm:w-auto mt-2 ${variantsData.length >= 6 ? 'hidden': '' }`}>
                    + Add Variant (Commercial)
                </button>
             )}
          </div>
        );
      case 4: 
        const controlRatesForDisplay = allVariantRates.find(r => r.id === controlVariantId); 
        
        const MetricItem: React.FC<{ label: string; value?: string; performanceNode?: React.ReactNode; significanceNode?: React.ReactNode }> = 
            ({ label, value, performanceNode, significanceNode }) => (
          <div className="flex justify-between items-baseline py-1.5 border-b border-crm-background dark:border-crm-dm-background last:border-b-0">
            <span className="text-sm text-crm-text-muted dark:text-crm-dm-text-muted">{label}:</span>
            <span className="text-sm font-medium text-crm-text-body dark:text-crm-dm-text-body text-right">
              {value || 'N/A'}
              {performanceNode}
              {significanceNode}
            </span>
          </div>
        );

        return (
          <div className="space-y-6">
            <div className={`p-4 border rounded-lg shadow ${
                testConclusion?.isFlatResult ? 'border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-amber-900/20' 
                : 'border-crm-accent dark:border-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/20'
              }`}>
                <h3 className="text-lg font-semibold text-crm-text-heading dark:text-crm-dm-text-heading mb-2">
                   Test Conclusion{testName && `: `}<span className="text-crm-accent">{testName}</span>
                </h3>
                {testConclusion?.summaryText || <p>Generating conclusion...</p>}
            </div>

            <div>
                <button
                    onClick={() => setIsReviewDetailsExpanded(prev => !prev)}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-crm-accent dark:text-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/30 rounded-md focus:outline-none flex justify-between items-center"
                    aria-expanded={isReviewDetailsExpanded}
                    aria-controls="test-details-cards-container"
                >
                    <span>{isReviewDetailsExpanded ? 'Hide' : 'Show'} Full Test Details</span>
                    <svg className={`w-5 h-5 transform transition-transform duration-200 ${isReviewDetailsExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {isReviewDetailsExpanded && (
                    <div id="test-details-cards-container" className="mt-4">
                        <h4 className="text-md font-semibold text-crm-text-heading dark:text-crm-dm-text-heading mb-3">
                            Detailed Metrics per Variant
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {variantsData.map(variant => {
                                const variantCalculatedData = allVariantRates.find(vrd => vrd.id === variant.id);
                                const isCurrentControl = variant.id === controlVariantId;
                                const isOverallWinner = testConclusion?.overallWinnerVariantName === variant.name;

                                let cardSpecificClasses = 'border-crm-border dark:border-crm-dm-border bg-crm-card dark:bg-crm-dm-card';
                                let winnerBadgeText: string | null = null;
                                let badgeColorClass = "text-yellow-500 dark:text-yellow-400"; 
                                let badgeTooltip = "Overall Winner";

                                if (isOverallWinner) {
                                    if (testConclusion?.isFlatResult) {
                                        cardSpecificClasses = 'border-amber-500 dark:border-amber-400 bg-amber-50/70 dark:bg-amber-900/20';
                                        winnerBadgeText = '(Flat Result)'; 
                                        badgeColorClass = "text-amber-700 dark:text-amber-500"; 
                                        badgeTooltip = "Overall Flat Result (difference not statistically significant or negligible)";
                                    } else if (isCurrentControl) {
                                        cardSpecificClasses = 'border-green-600 dark:border-green-500 bg-green-100/60 dark:bg-green-800/30 shadow-lg ring-2 ring-green-500 ring-offset-1 dark:ring-offset-crm-dm-card';
                                        winnerBadgeText = '🏆 (Control Winner)';
                                    } else {
                                        cardSpecificClasses = 'border-green-500 dark:border-green-400 bg-green-50/70 dark:bg-green-900/20';
                                        winnerBadgeText = '🏆';
                                    }
                                } else if (isCurrentControl) {
                                    cardSpecificClasses = 'border-crm-accent dark:border-fuchsia-500 bg-fuchsia-50/50 dark:bg-fuchsia-900/10';
                                }
                                
                                return (
                                    <div key={variant.id} className={`p-4 rounded-lg shadow-md border ${cardSpecificClasses}`}>
                                        <h5 className={`text-lg font-semibold mb-3 flex items-center ${
                                            isOverallWinner && !testConclusion?.isFlatResult ? (isCurrentControl ? 'text-green-700 dark:text-green-300' : 'text-green-600 dark:text-green-400') : 
                                            isOverallWinner && testConclusion?.isFlatResult ? 'text-amber-700 dark:text-amber-500' :
                                            (isCurrentControl ? 'text-crm-accent dark:text-fuchsia-400' : 'text-crm-text-heading dark:text-crm-dm-text-heading')
                                          }`}>
                                            {variant.name} 
                                            {isCurrentControl && !winnerBadgeText && <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">(Control)</span>}
                                            {winnerBadgeText && (
                                                <span 
                                                    className={`ml-2 text-sm font-semibold ${badgeColorClass}`} 
                                                    title={badgeTooltip}
                                                >
                                                    {winnerBadgeText}
                                                </span>
                                            )}
                                        </h5>
                                        
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold uppercase text-crm-text-muted dark:text-crm-dm-text-muted tracking-wider mb-1 pt-1 border-t border-crm-border dark:border-crm-dm-border">Engagement ({channel.toUpperCase()})</p>
                                            <MetricItem label="Send Volume" value={formatNumberForDisplay(variantCalculatedData?.sendsRaw)} />
                                            {channel === 'email' && (
                                                <>
                                                    <MetricItem label="Unique Opens" value={formatNumberForDisplay(variantCalculatedData?.uniqueOpensRaw)} />
                                                    <MetricItem 
                                                        label="Open Rate" 
                                                        value={variantCalculatedData?.openRate}
                                                        performanceNode={!isCurrentControl && controlRatesForDisplay ? getPerformanceRelativeToControl(controlRatesForDisplay.openRate, variantCalculatedData?.openRate) : undefined}
                                                        significanceNode={renderSignificanceIndicator(variantCalculatedData?.openRateSig, isCurrentControl)}
                                                    />
                                                </>
                                            )}
                                            <MetricItem label="Unique Clicks" value={formatNumberForDisplay(variantCalculatedData?.uniqueClicksRaw)} />
                                            <MetricItem 
                                                label="Click-Through Rate" 
                                                value={variantCalculatedData?.clickThroughRate}
                                                performanceNode={!isCurrentControl && controlRatesForDisplay ? getPerformanceRelativeToControl(controlRatesForDisplay.clickThroughRate, variantCalculatedData?.clickThroughRate) : undefined}
                                                significanceNode={renderSignificanceIndicator(variantCalculatedData?.clickThroughRateSig, isCurrentControl)}
                                            />

                                            {includeCommercial && variantCalculatedData && (
                                              is1066ModeActive ? (
                                                <>
                                                  <p className="text-xs font-semibold uppercase text-crm-text-muted dark:text-crm-dm-text-muted tracking-wider mb-1 pt-3 mt-2 border-t border-crm-border dark:border-crm-dm-border">
                                                    1066 Metrics ({currencySymbols[currency]})
                                                  </p>
                                                  <MetricItem 
                                                    label="SRR (%)" 
                                                    value={variantCalculatedData.srrRate} 
                                                    performanceNode={!isCurrentControl && controlRatesForDisplay ? getPerformanceRelativeToControl(controlRatesForDisplay.srrRate, variantCalculatedData.srrRate) : undefined}
                                                    // No significance for 1066 direct inputs
                                                  />
                                                  <MetricItem 
                                                    label="MRR (%)" 
                                                    value={variantCalculatedData.mrrRate} 
                                                    performanceNode={!isCurrentControl && controlRatesForDisplay ? getPerformanceRelativeToControl(controlRatesForDisplay.mrrRate, variantCalculatedData.mrrRate) : undefined}
                                                    // No significance for 1066 direct inputs
                                                  />
                                                  <MetricItem 
                                                    label="Average IPP" 
                                                    value={variantCalculatedData.averageIpp}
                                                    performanceNode={!isCurrentControl && controlRatesForDisplay ? getPerformanceRelativeToControl(controlRatesForDisplay.averageIpp, variantCalculatedData.averageIpp) : undefined}
                                                    // No significance for 1066 direct inputs
                                                  />
                                                </>
                                              ) : ( // Generic commercial
                                                <>
                                                    <p className="text-xs font-semibold uppercase text-crm-text-muted dark:text-crm-dm-text-muted tracking-wider mb-1 pt-3 mt-2 border-t border-crm-border dark:border-crm-dm-border">
                                                        Commercial Impact ({conversionMetricName || 'Metric'} - {currencySymbols[currency]})
                                                    </p>
                                                    <MetricItem label={`${conversionMetricName || "Conversions"}`} value={formatNumberForDisplay(variantCalculatedData.conversionsRaw)} />
                                                    <MetricItem 
                                                        label={`${conversionMetricName || 'Conversion'} Rate`} 
                                                        value={variantCalculatedData.conversionRate}
                                                        performanceNode={!isCurrentControl && controlRatesForDisplay ? getPerformanceRelativeToControl(controlRatesForDisplay.conversionRate, variantCalculatedData.conversionRate) : undefined}
                                                        significanceNode={renderSignificanceIndicator(variantCalculatedData.conversionRateSig, isCurrentControl)}
                                                    />
                                                    <MetricItem 
                                                        label={`Avg. Value per ${conversionMetricName || 'Conversion'}`} 
                                                        value={formatCurrencyForDisplay(variantsData.find(v => v.id === variant.id)?.averageValuePerConversion, currency)}
                                                    />
                                                    <MetricItem 
                                                        label="Total Revenue" 
                                                        value={variantCalculatedData.totalRevenue} 
                                                    />
                                                </>
                                              )
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                         <p className="mt-4 text-xs text-crm-text-muted dark:text-crm-dm-text-muted">
                           Statistical significance testing (typically at 95% confidence, p &lt; {SIGNIFICANCE_THRESHOLD}, two-tailed) is applied to Engagement (Open Rate, Click-Through Rate) and Generic Commercial Rate metrics where underlying count data is available. 
                           Open Rate and Click-Through Rate are calculated relative to Send Volume.
                           Generic Conversion Rate is calculated relative to Unique Clicks.
                           1066 Mode metrics (SRR, MRR, IPP) are compared based on directly inputted values and do not undergo this statistical significance test within the tool.
                         </p>
                    </div>
                )}
            </div>
          </div>
        );
      default:
        return <p>Unknown step.</p>;
    }
  };

  const stepTitles = ["Test Setup", "Variant Metrics", "Commercial Impact", "Review & Analyze"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-crm-text-heading dark:text-crm-dm-text-heading transition-colors duration-300">
            Test Analysis Tool
            </h2>
            {is1066ModeActive && (
                 <span className="ml-3 text-xs font-bold px-2 py-0.5 rounded bg-sky-500 text-white animate-pulse" title="1066 Mode is active for specialized commercial metrics. Toggle with Ctrl+Shift+L.">
                    1066
                </span>
            )}
        </div>
        <button
          ref={backToHubButtonRef}
          onClick={onClose}
          className="flex items-center text-crm-accent hover:underline text-sm font-medium"
          aria-label="Back to Hub. Right-click or Ctrl+Shift+D to toggle Developer Tools. Ctrl+Shift+L to toggle 1066 Mode."
          title="Right-click or Ctrl+Shift+D for Dev Tools. Ctrl+Shift+L for 1066 Mode."
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Back to Hub
        </button>
      </div>
      
      <div 
        className="mb-6 p-4 rounded-lg bg-amber-100 dark:bg-amber-800/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 flex items-center shadow"
        role="alert"
      >
        <BeakerIcon className="w-6 h-6 mr-3 flex-shrink-0 text-amber-500 dark:text-amber-400" />
        <div>
          <p className="font-semibold text-sm sm:text-base">Work in Progress & Under Development</p>
          <p className="text-xs sm:text-sm">
            This tool is currently under active development. Features may be incomplete, experimental, or subject to change.
            Your feedback is valuable during this phase!
          </p>
        </div>
      </div>

      {isDevToolsVisible && (
        <div className={`${cardClasses} space-y-4 mb-8 relative border-2 border-dashed border-sky-500 dark:border-sky-400`}>
            <button 
                onClick={() => setIsDevToolsVisible(false)} 
                className="absolute top-3 right-3 p-1.5 rounded-full text-crm-text-muted dark:text-crm-dm-text-muted hover:bg-crm-icon-bg dark:hover:bg-crm-dm-icon-bg focus:outline-none focus:ring-2 focus:ring-crm-accent" 
                aria-label="Close developer tools"
            >
                <XMarkIcon className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-sky-600 dark:text-sky-400 pr-8">Developer Tools</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                    onClick={handleFillWithRandomData}
                    className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-400 dark:focus:ring-offset-crm-dm-card transition-colors duration-150"
                >
                    Fill with Random Data (GBP)
                </button>
                <button
                    onClick={handleFillWithFlatData}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400 dark:focus:ring-offset-crm-dm-card transition-colors duration-150"
                >
                    Fill with Flat Results Data (GBP)
                </button>
            </div>
            <p className="text-xs text-crm-text-muted dark:text-crm-dm-text-muted text-center">
                Toggle DevTools: Ctrl+Shift+D or Right-Click "Back to Hub". <br/> Toggle 1066 Mode: Ctrl+Shift+L.
            </p>
        </div>
      )}

      <div className={`${cardClasses}`}>
        <div className="mb-6">
          <p className="text-sm font-medium text-crm-text-muted dark:text-crm-dm-text-muted">
            Step {currentStep} of {totalSteps}: <span className="text-crm-text-body dark:text-crm-dm-text-body font-semibold">{stepTitles[currentStep-1]}</span>
          </p>
          <div className="mt-1 w-full bg-crm-border dark:bg-crm-dm-border rounded-full h-2">
            <div 
              className="bg-crm-accent h-2 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="min-h-[250px]"> 
          {isAnalyzing ? <AnalysisLoadingScreen /> : renderStepContent()}
        </div>

        <div className="mt-8 pt-6 border-t border-crm-border dark:border-crm-dm-border flex justify-between items-center">
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 1 || isAnalyzing}
            className={secondaryButtonClasses}
          >
            Previous
          </button>
          {currentStep < totalSteps ? (
            <button onClick={handleNextStep} className={buttonClasses} disabled={isAnalyzing}>
              Next
            </button>
          ) : (
            <button 
                onClick={() => {
                    setCurrentStep(1); 
                    setTestName('');
                    setVariantsData([createNewVariant(0, 'Variant A'), createNewVariant(1, 'Variant B')].map(v => ({...v, ...initialMetrics}))); 
                    setControlVariantId('variant-0');
                    setNextVariantNumericId(2);
                    setIncludeCommercial(false);
                    setChannel('email');
                    setPrimaryEngagementMetric('clickThroughRate');
                    setConversionMetricName('Purchases'); 
                    setMetricNameSelectionOption('custom'); 
                    setCurrency('GBP'); 
                    setIsReviewDetailsExpanded(false); 
                    setTestConclusion(null); 
                }} 
                className={buttonClasses}
            >
              Start New Analysis
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestAnalysisTool;