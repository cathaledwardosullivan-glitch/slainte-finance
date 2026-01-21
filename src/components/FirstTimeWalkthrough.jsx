import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, ArrowRight, Play, CheckCircle, Upload, BarChart3, FileText, Settings } from 'lucide-react';

const FirstTimeWalkthrough = ({ 
  onComplete, 
  onSkip, 
  isVisible,
  currentView,
  onNavigateToView 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(isVisible);
  const overlayRef = useRef(null);

  // Walkthrough steps tailored for GP Practice Manager
  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to GP Practice Finance Manager!',
      content: (
        <div className="space-y-4">
          <p className="text-lg">Let's get you started with managing your practice finances efficiently.</p>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">What this app does:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>� Automatically categorizes bank transactions</li>
              <li>� Generates professional reports for your accountant</li>
              <li>� Learns from your choices to improve accuracy</li>
              <li>� Separates business expenses from personal drawings</li>
            </ul>
          </div>
          <p className="text-sm text-gray-600">
            This tour will show you the 4 essential steps to get your first reports ready.
          </p>
        </div>
      ),
      target: null,
      position: 'center',
      view: null
    },
    {
      id: 'upload-step',
      title: 'Step 1: Upload Your Bank Data',
      content: (
        <div className="space-y-3">
          <p>Start by uploading your bank statement file from your online banking.</p>
          <div className="bg-green-50 p-3 rounded">
            <p className="text-sm text-green-800 font-medium">Supported formats:</p>
            <p className="text-sm text-green-700">� CSV files from most Irish banks</p>
          </div>
          <p className="text-sm text-gray-600">
            The app will automatically read the Date, Details, Debit, and Credit columns.
          </p>
        </div>
      ),
      target: 'upload-area',
      position: 'bottom',
      view: 'upload',
      action: () => onNavigateToView('upload')
    },
    {
      id: 'categorization',
      title: 'Step 2: Smart Categorization',
      content: (
        <div className="space-y-3">
          <p>After upload, the app automatically categorizes your transactions using AI.</p>
          <div className="bg-purple-50 p-3 rounded">
            <p className="text-sm text-purple-800 font-medium">How it works:</p>
            <p className="text-sm text-purple-700">� Recognizes payees like ESB, Vodafone, etc.</p>
            <p className="text-sm text-purple-700">� Learns from your manual corrections</p>
            <p className="text-sm text-purple-700">� Gets smarter with each file you process</p>
          </div>
          <p className="text-sm text-gray-600">
            Initially, you'll need to manually categorize some transactions, but this gets much faster over time.
          </p>
        </div>
      ),
      target: 'transaction-stats',
      position: 'left',
      view: 'upload',
      action: () => onNavigateToView('upload')
    },
    {
      id: 'dashboard-overview',
      title: 'Step 3: Review Your Financial Overview',
      content: (
        <div className="space-y-3">
          <p>The dashboard shows your practice's financial health at a glance.</p>
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-sm text-blue-800 font-medium">Key insights:</p>
            <p className="text-sm text-blue-700">� Total income vs expenses</p>
            <p className="text-sm text-blue-700">� Monthly trends and patterns</p>
            <p className="text-sm text-blue-700">� Comparison with previous periods</p>
          </div>
          <p className="text-sm text-gray-600">
            Perfect for monthly reviews and planning meetings.
          </p>
        </div>
      ),
      target: 'dashboard-charts',
      position: 'top',
      view: 'dashboard',
      action: () => onNavigateToView('dashboard')
    },
    {
      id: 'transaction-management',
      title: 'Step 4: Manage Individual Transactions',
      content: (
        <div className="space-y-3">
          <p>Review and adjust transaction categories as needed.</p>
          <div className="bg-yellow-50 p-3 rounded">
            <p className="text-sm text-yellow-800 font-medium">Pro tips:</p>
            <p className="text-sm text-yellow-700">� Use search to find specific transactions</p>
            <p className="text-sm text-yellow-700">� Bulk categorize similar items</p>
            <p className="text-sm text-yellow-700">� The app remembers your choices</p>
          </div>
          <p className="text-sm text-gray-600">
            Focus on getting the major expenses categorized correctly first.
          </p>
        </div>
      ),
      target: 'transaction-table',
      position: 'top',
      view: 'transactions',
      action: () => onNavigateToView('transactions')
    },
    {
      id: 'export-reports',
      title: 'Step 5: Generate Professional Reports',
      content: (
        <div className="space-y-3">
          <p>Export professional reports ready for your accountant.</p>
          <div className="bg-green-50 p-3 rounded">
            <p className="text-sm text-green-800 font-medium">Report package includes:</p>
            <p className="text-sm text-green-700">� Profit & Loss statement</p>
            <p className="text-sm text-green-700">� Income & expenditure summaries</p>
            <p className="text-sm text-green-700">� Complete transaction list</p>
          </div>
          <p className="text-sm text-gray-600">
            These CSV files open perfectly in Excel for further analysis.
          </p>
        </div>
      ),
      target: 'export-reports',
      position: 'left',
      view: 'export',
      action: () => onNavigateToView('export')
    },
    {
      id: 'completion',
      title: 'You\'re All Set!',
      content: (
        <div className="space-y-4">
          <p className="text-lg">Congratulations! You now know how to use the GP Practice Finance Manager.</p>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">Quick reference workflow:</h4>
            <ol className="text-sm text-green-700 space-y-1">
              <li>1. Upload monthly bank statements</li>
              <li>2. Review and categorize any unidentified transactions</li>
              <li>3. Check the dashboard for insights</li>
              <li>4. Export reports for your accountant</li>
            </ol>
          </div>
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-sm text-blue-800 font-medium"> Remember:</p>
            <p className="text-sm text-blue-700">The more you use it, the smarter it gets at categorizing your transactions automatically.</p>
          </div>
          <p className="text-sm text-gray-600">
            You can always restart this tour from the Help menu if needed.
          </p>
        </div>
      ),
      target: null,
      position: 'center',
      view: null
    }
  ];

  const currentStepData = steps[currentStep];

  useEffect(() => {
    if (isVisible && currentStepData?.action) {
      currentStepData.action();
    }
  }, [currentStep, isVisible]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsActive(false);
    onComplete();
  };

  const handleSkip = () => {
    setIsActive(false);
    onSkip();
  };

  // Find the target element
  const getTargetElement = () => {
    if (!currentStepData?.target) return null;
    return document.querySelector(`[data-walkthrough-id="${currentStepData.target}"]`);
  };

  // Calculate tooltip position
  const getTooltipPosition = () => {
    const targetElement = getTargetElement();
    if (!targetElement) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001
      };
    }

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 300;

    let top, left, transform = '';

    switch (currentStepData.position) {
      case 'top':
        top = rect.top - tooltipHeight - 20;
        left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        top = rect.bottom + 20;
        left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        left = rect.left - tooltipWidth - 20;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        left = rect.right + 20;
        break;
      default:
        top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        left = rect.right + 20;
    }

    // Keep tooltip on screen
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;
    if (top < 10) top = 10;
    if (top + tooltipHeight > window.innerHeight - 10) top = window.innerHeight - tooltipHeight - 10;

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 10001
    };
  };

  if (!isActive) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        ref={overlayRef}
        className="fixed inset-0 bg-black bg-opacity-50 z-10000"
        style={{ zIndex: 10000 }}
      >
        {/* Highlight target element */}
        {currentStepData?.target && getTargetElement() && (
          <div
            className="absolute border-4 border-blue-400 rounded-lg shadow-lg"
            style={{
              top: getTargetElement().getBoundingClientRect().top - 4,
              left: getTargetElement().getBoundingClientRect().left - 4,
              width: getTargetElement().getBoundingClientRect().width + 8,
              height: getTargetElement().getBoundingClientRect().height + 8,
              background: 'rgba(59, 130, 246, 0.1)',
              zIndex: 10000
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        className="bg-white rounded-lg shadow-xl border max-w-md"
        style={getTooltipPosition()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {currentStep + 1}
            </div>
            <h3 className="font-semibold text-gray-800">{currentStepData.title}</h3>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {currentStepData.content}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="flex space-x-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentStep ? 'bg-blue-600' : 
                  index < currentStep ? 'bg-green-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          <div className="flex space-x-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Previous
              </button>
            )}
            
            <button
              onClick={currentStep === 0 ? () => setCurrentStep(1) : handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center text-sm font-medium"
            >
              {currentStep === 0 ? (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Start Tour
                </>
              ) : currentStep === steps.length - 1 ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default FirstTimeWalkthrough;