import React, { useState } from 'react';
import { Database, BarChart3, ListChecks, MessageSquare, ClipboardList } from 'lucide-react';
import COLORS from '../../utils/colors';
import AreaDataCollector from '../NewGMSHealthCheck/AreaDataCollector';
import AreaAnalysisPanel from '../NewGMSHealthCheck/AreaAnalysisPanel';
import AreaTaskPanel from '../NewGMSHealthCheck/AreaTaskPanel';
import GuidedDataEntry from './GuidedDataEntry';
import { GUIDED_AREAS, hasExistingData } from '../../data/guidedEntryPrompts';

const TABS = [
  { id: 'data', label: 'Data', icon: Database },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
  { id: 'actions', label: 'Actions', icon: ListChecks }
];

/**
 * AreaDetailPanel - Area view with Data/Analysis/Actions tabs.
 * Data tab offers a Guided (conversational) and Form mode for areas
 * that support guided entry.
 */
const AreaDetailPanel = ({
  areaId,
  readiness,
  analysis,
  recommendations,
  healthCheckData,
  paymentAnalysisData,
  onUpdate
}) => {
  const [activeTab, setActiveTab] = useState('analysis');
  const areaReadiness = readiness?.[areaId];

  // Guided mode: default to guided for areas that support it AND have no data yet
  const supportsGuided = GUIDED_AREAS.includes(areaId);
  const [dataMode, setDataMode] = useState(() =>
    supportsGuided && !hasExistingData(areaId, healthCheckData) ? 'guided' : 'form'
  );

  return (
    <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: isActive ? COLORS.slainteBlue : COLORS.bgPage,
                color: isActive ? 'white' : COLORS.textSecondary,
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'data' && (
        <>
          {/* Mode toggle for areas that support guided entry */}
          {supportsGuided && (
            <div style={{
              display: 'flex',
              gap: '0.25rem',
              marginBottom: '1rem',
              padding: '0.2rem',
              backgroundColor: COLORS.bgPage,
              borderRadius: '0.375rem',
              width: 'fit-content'
            }}>
              <button
                onClick={() => setDataMode('guided')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.25rem',
                  border: 'none',
                  backgroundColor: dataMode === 'guided' ? COLORS.white : 'transparent',
                  color: dataMode === 'guided' ? COLORS.slainteBlue : COLORS.textSecondary,
                  fontSize: '0.78rem',
                  fontWeight: dataMode === 'guided' ? 600 : 400,
                  cursor: 'pointer',
                  boxShadow: dataMode === 'guided' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <MessageSquare size={12} />
                Guided
              </button>
              <button
                onClick={() => setDataMode('form')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.25rem',
                  border: 'none',
                  backgroundColor: dataMode === 'form' ? COLORS.white : 'transparent',
                  color: dataMode === 'form' ? COLORS.slainteBlue : COLORS.textSecondary,
                  fontSize: '0.78rem',
                  fontWeight: dataMode === 'form' ? 600 : 400,
                  cursor: 'pointer',
                  boxShadow: dataMode === 'form' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <ClipboardList size={12} />
                Form
              </button>
            </div>
          )}

          {dataMode === 'guided' && supportsGuided ? (
            <GuidedDataEntry
              areaId={areaId}
              healthCheckData={healthCheckData}
              onUpdate={onUpdate}
              onSwitchToForm={() => setDataMode('form')}
            />
          ) : (
            <AreaDataCollector
              areaId={areaId}
              readiness={areaReadiness}
              healthCheckData={healthCheckData}
              paymentAnalysisData={paymentAnalysisData}
              onUpdate={onUpdate}
            />
          )}
        </>
      )}

      {activeTab === 'analysis' && (
        <AreaAnalysisPanel
          areaId={areaId}
          analysis={analysis}
          canAnalyze={areaReadiness?.canAnalyze}
          readiness={areaReadiness}
          healthCheckData={healthCheckData}
        />
      )}

      {activeTab === 'actions' && (
        <AreaTaskPanel
          areaId={areaId}
          recommendations={recommendations}
          canAnalyze={areaReadiness?.canAnalyze}
          healthCheckData={healthCheckData}
        />
      )}
    </div>
  );
};

export default AreaDetailPanel;
