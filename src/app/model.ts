export type IntegrationId =
  | 'payments'
  | 'identity'
  | 'delivery'
  | 'messaging'
  | 'analytics';

export type ResponseLevel = 'allow' | 'observe' | 'limit' | 'quarantine';

export type ScenarioId =
  | 'normal'
  | 'sales-spike'
  | 'scope-drift'
  | 'record-spike'
  | 'behavior-change';

export interface Integration {
  id: IntegrationId;
  label: string;
  baselineFields: readonly string[];
  recordLimit: number;
}

export interface ActivityEvent {
  id: number;
  occurredAt: string;
  integrationId: IntegrationId;
  operation: string;
  fields: readonly string[];
  recordCount: number;
  response: ResponseLevel;
  reason: string;
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
}

export const INTEGRATIONS: readonly Integration[] = [
  {
    id: 'payments',
    label: 'Payments',
    baselineFields: ['order_id', 'amount', 'email'],
    recordLimit: 120,
  },
  {
    id: 'identity',
    label: 'Identity',
    baselineFields: ['name', 'email', 'kyc_status'],
    recordLimit: 80,
  },
  {
    id: 'delivery',
    label: 'Delivery',
    baselineFields: ['name', 'phone', 'delivery_address', 'order_id'],
    recordLimit: 150,
  },
  {
    id: 'messaging',
    label: 'Messaging',
    baselineFields: ['name', 'phone', 'order_status'],
    recordLimit: 180,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    baselineFields: ['order_id', 'product_id', 'amount', 'timestamp'],
    recordLimit: 320,
  },
] as const;

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'normal',
    label: 'Normal traffic',
    description: 'Expected access patterns within declared scopes.',
  },
  {
    id: 'sales-spike',
    label: 'Legitimate sales spike',
    description: 'Volume rises while scope and business context remain valid.',
  },
  {
    id: 'scope-drift',
    label: 'New data type',
    description: 'Analytics begins touching a field it never declared.',
  },
  {
    id: 'record-spike',
    label: 'Excessive records',
    description: 'Messaging pulls far more customer records than its baseline allows.',
  },
  {
    id: 'behavior-change',
    label: 'Behavior change',
    description: 'Delivery enumerates customer profiles outside an active order flow.',
  },
] as const;

export const CUSTOMER_FIELDS = [
  'name',
  'email',
  'phone',
  'delivery_address',
  'order_id',
  'amount',
  'product_id',
  'timestamp',
  'kyc_status',
] as const;

export const RESPONSE_LEVELS: readonly ResponseLevel[] = [
  'allow',
  'observe',
  'limit',
  'quarantine',
] as const;

export function getIntegration(id: IntegrationId): Integration {
  const integration = INTEGRATIONS.find((item) => item.id === id);
  if (!integration) {
    throw new Error(`Unknown integration: ${id}`);
  }
  return integration;
}

export function getScenario(id: ScenarioId): Scenario {
  const scenario = SCENARIOS.find((item) => item.id === id);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${id}`);
  }
  return scenario;
}

function timestamp(): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
}

export function createActivityEvent(id: number, scenarioId: ScenarioId): ActivityEvent {
  const integration = INTEGRATIONS[id % INTEGRATIONS.length];

  const baseEvent: ActivityEvent = {
    id,
    occurredAt: timestamp(),
    integrationId: integration.id,
    operation: 'read',
    fields: integration.baselineFields,
    recordCount: 20 + ((id * 13) % 70),
    response: 'allow',
    reason: 'Within declared scope and historical baseline.',
  };

  switch (scenarioId) {
    case 'normal':
      return baseEvent;

    case 'sales-spike': {
      const candidates: readonly IntegrationId[] = ['payments', 'analytics', 'delivery'];
      const selected = getIntegration(candidates[id % candidates.length]);
      return {
        ...baseEvent,
        integrationId: selected.id,
        fields: selected.baselineFields,
        recordCount: Math.floor(selected.recordLimit * 1.6),
        response: 'observe',
        reason: 'Higher volume matches the same field shape and a correlated sales surge.',
      };
    }

    case 'scope-drift':
      return {
        ...baseEvent,
        integrationId: 'analytics',
        fields: ['order_id', 'product_id', 'amount', 'timestamp', 'phone'],
        recordCount: 72,
        response: 'limit',
        reason: 'Undeclared field detected: phone.',
      };

    case 'record-spike':
      return {
        ...baseEvent,
        integrationId: 'messaging',
        fields: getIntegration('messaging').baselineFields,
        recordCount: 640,
        response: 'quarantine',
        reason: 'Record volume exceeded the dynamic baseline without a correlated business event.',
      };

    case 'behavior-change':
      return {
        ...baseEvent,
        integrationId: 'delivery',
        operation: 'enumerate_profiles',
        fields: ['name', 'phone', 'delivery_address'],
        recordCount: 210,
        response: 'limit',
        reason: 'Profile enumeration occurred outside the expected order-driven sequence.',
      };
  }
}
