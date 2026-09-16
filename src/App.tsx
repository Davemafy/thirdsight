import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Database,
  Eye,
  Gauge,
  Radio,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserRoundCheck,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import {
  CUSTOMER_FIELDS,
  INTEGRATIONS,
  RESPONSE_LEVELS,
  SCENARIOS,
  createActivityEvent,
  getIntegration,
  getScenario,
  type ActivityEvent,
  type IntegrationId,
  type ResponseLevel,
  type ScenarioId,
} from './model';

const FEED_SIZE = 9;
const EVENT_INTERVAL_MS = 1_500;

const integrationIcons: Record<IntegrationId, LucideIcon> = {
  payments: ShoppingCart,
  identity: UserRoundCheck,
  delivery: Truck,
  messaging: Webhook,
  analytics: Gauge,
};

const responseMeta: Record<ResponseLevel, { label: string; icon: LucideIcon }> = {
  allow: { label: 'Allow', icon: CheckCircle2 },
  observe: { label: 'Observe', icon: Eye },
  limit: { label: 'Limit', icon: AlertTriangle },
  quarantine: { label: 'Quarantine', icon: Ban },
};

function seedFeed(): ActivityEvent[] {
  return Array.from({ length: 7 }, (_, index) =>
    createActivityEvent(index, 'normal'),
  ).reverse();
}

export default function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('normal');
  const [events, setEvents] = useState<ActivityEvent[]>(seedFeed);
  const nextEventId = useRef(8);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const event = createActivityEvent(nextEventId.current++, scenarioId);
      setEvents((current) => [event, ...current].slice(0, FEED_SIZE));
    }, EVENT_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [scenarioId]);

  const currentEvent = events[0];
  const currentScenario = getScenario(scenarioId);
  const touchedFields = useMemo(
    () => new Set(currentEvent?.fields ?? []),
    [currentEvent],
  );
  const activeRiskSignals = events.filter(
    ({ response }) => response === 'limit' || response === 'quarantine',
  ).length;

  function changeScenario(nextScenarioId: ScenarioId) {
    setScenarioId(nextScenarioId);
    const event = createActivityEvent(nextEventId.current++, nextScenarioId);
    setEvents((current) => [event, ...current].slice(0, FEED_SIZE));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark" aria-hidden="true">
            <ShieldCheck size={20} />
          </div>
          <div>
            <strong>ThirdSight</strong>
            <span>Integration control plane</span>
          </div>
        </div>

        <div className="side-card">
          <span className="eyebrow">Protection model</span>
          <strong>Proportional controls</strong>
          <p>
            Observe, limit, or quarantine behavior without treating every anomaly
            as a breach.
          </p>
        </div>
      </aside>

      <main>
        <header className="page-header">
          <div>
            <span className="eyebrow">Commerce & consumer protection</span>
            <h1>Third-party integration control plane</h1>
            <p>
              See what integrations access, detect unexpected behavior, and respond
              proportionally.
            </p>
          </div>
          <div className="live-indicator">
            <Radio size={15} />
            Live
          </div>
        </header>

        <section className="scenario-bar" aria-labelledby="scenario-heading">
          <div>
            <span className="eyebrow">Demo scenario</span>
            <strong id="scenario-heading">{currentScenario.label}</strong>
            <small>{currentScenario.description}</small>
          </div>
          <label className="scenario-select">
            <span className="sr-only">Select demo scenario</span>
            <select
              value={scenarioId}
              onChange={(event) =>
                changeScenario(event.target.value as ScenarioId)
              }
            >
              {SCENARIOS.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="stats" aria-label="System summary">
          <article className="stat">
            <span>Integrations watched</span>
            <strong>{INTEGRATIONS.length}</strong>
            <small>payments · identity · delivery · messaging · analytics</small>
          </article>
          <article className="stat">
            <span>Events / minute</span>
            <strong>{scenarioId === 'sales-spike' ? '1,284' : '486'}</strong>
            <small>
              {scenarioId === 'sales-spike'
                ? '+164% correlated with sales'
                : 'within current baseline'}
            </small>
          </article>
          <article className="stat">
            <span>Active risk signals</span>
            <strong>{activeRiskSignals}</strong>
            <small>
              {activeRiskSignals > 0
                ? 'control required'
                : 'no intervention needed'}
            </small>
          </article>
        </section>

        <section className="primary-grid">
          <article className="panel map-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Live access map</span>
                <h2>Who can touch what?</h2>
              </div>
              <span className="pulse-dot" aria-hidden="true" />
            </div>

            <div className="access-map">
              <div className="vault-node">
                <div className="vault-icon" aria-hidden="true">
                  <Database size={22} />
                </div>
                <strong>Customer data vault</strong>
                <span>simulated commerce platform</span>
              </div>

              <div className="integration-list">
                {INTEGRATIONS.map((integration) => {
                  const Icon = integrationIcons[integration.id];
                  const isActive = currentEvent?.integrationId === integration.id;

                  return (
                    <div
                      className={`integration-row${isActive ? ' is-active' : ''}`}
                      key={integration.id}
                    >
                      <div className="integration-icon" aria-hidden="true">
                        <Icon size={18} />
                      </div>
                      <div className="integration-meta">
                        <strong>{integration.label}</strong>
                        <span>{integration.baselineFields.length} declared fields</span>
                      </div>
                      <ChevronRight size={15} aria-hidden="true" />
                    </div>
                  );
                })}
              </div>

              <div className="field-list">
                {CUSTOMER_FIELDS.map((field) => (
                  <div
                    className={touchedFields.has(field) ? 'is-touched' : ''}
                    key={field}
                  >
                    <CircleDot size={12} aria-hidden="true" />
                    {field}
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="panel decision-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Decision engine</span>
                <h2>Current verdict</h2>
              </div>
              {currentEvent ? (
                <ResponseBadge response={currentEvent.response} />
              ) : null}
            </div>

            {currentEvent ? (
              <>
                <div className="verdict-card">
                  <VerdictRow
                    label="Integration"
                    value={getIntegration(currentEvent.integrationId).label}
                  />
                  <VerdictRow label="Operation" value={currentEvent.operation} />
                  <VerdictRow
                    label="Records touched"
                    value={String(currentEvent.recordCount)}
                  />
                  <VerdictRow
                    label="Data types"
                    value={String(currentEvent.fields.length)}
                  />
                </div>

                <div className="reason-block">
                  <span className="eyebrow">Why</span>
                  <p>{currentEvent.reason}</p>
                </div>

                <div className="response-ladder" aria-label="Response ladder">
                  {RESPONSE_LEVELS.map((level, index) => (
                    <div
                      className={
                        currentEvent.response === level ? 'is-selected' : ''
                      }
                      key={level}
                    >
                      <span>{index + 1}</span>
                      <strong>{responseMeta[level].label}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </article>
        </section>

        <section className="panel feed-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Realtime evidence</span>
              <h2>Integration activity</h2>
            </div>
            <span className="muted">simulated · no personal data</span>
          </div>

          <div
            className="activity-table"
            role="table"
            aria-label="Integration activity"
          >
            <div className="activity-row activity-header" role="row">
              <span>Time</span>
              <span>Integration</span>
              <span>Action</span>
              <span>Data</span>
              <span>Records</span>
              <span>Response</span>
            </div>
            {events.map((event) => (
              <div className="activity-row" role="row" key={event.id}>
                <span>{event.occurredAt}</span>
                <span>{getIntegration(event.integrationId).label}</span>
                <span>{event.operation}</span>
                <span className="field-chips">
                  {event.fields.slice(0, 3).map((field) => (
                    <i key={field}>{field}</i>
                  ))}
                  {event.fields.length > 3 ? (
                    <i>+{event.fields.length - 3}</i>
                  ) : null}
                </span>
                <span>{event.recordCount}</span>
                <span>
                  <ResponseBadge response={event.response} />
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function ResponseBadge({ response }: { response: ResponseLevel }) {
  const { label, icon: Icon } = responseMeta[response];
  return (
    <span className={`badge badge-${response}`}>
      <Icon size={15} />
      {label}
    </span>
  );
}

function VerdictRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="verdict-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
