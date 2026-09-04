const PLAN_SCHEMA = 'kinetic/gym/tool-plan@0.1';
const CLOSED_RIGHTS = new Set(['unknown', 'unverified']);
const PAID = new Set(['paid']);
const ACTIONABLE = new Set(['sandboxed', 'approved']);

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort();
}

function capabilityIds(provider) {
  return (provider.capabilities ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.capability)).filter(Boolean);
}

function frameworksOf(provider) {
  return uniqueSorted([...(provider.frameworks ?? []), ...(provider.framework_support ?? [])]);
}

function frameworkCompatible(provider, projectFrameworks) {
  const offered = frameworksOf(provider);
  if (offered.length === 0 || offered.includes('any')) return true;
  return offered.some((item) => projectFrameworks.includes(item));
}

function selection(provider, matched) {
  return {
    provider_id: provider.provider_id,
    capabilities_matched: uniqueSorted(matched),
    priority: Number.isInteger(provider.priority) ? provider.priority : 50,
    integration_mode: provider.integration_mode ?? 'unknown',
    integration_status: provider.integration_status ?? 'not-connected',
  };
}

function compareSelections(a, b) {
  return a.priority - b.priority || a.provider_id.localeCompare(b.provider_id);
}

function compareExcluded(a, b) {
  return a.provider_id.localeCompare(b.provider_id) || a.code.localeCompare(b.code);
}

function hasSecret(provider, secrets) {
  if (!provider.requires_secret) return true;
  const name = provider.secret_name;
  if (!name) return false;
  const value = secrets?.[name];
  return typeof value === 'string' && value.length > 0;
}

function hasEntitlement(provider, entitlements) {
  const id = provider.entitlement_id;
  if (!id) return false;
  return (entitlements ?? []).includes(id);
}

function isResearchOnly(provider) {
  return provider.integration_mode === 'research_only' || provider.category === 'REFERENCE_DISCOVERY_PROVIDER';
}

function isInstallableComponent(provider) {
  if (provider.installable_as_component === false) return false;
  if (isResearchOnly(provider)) return false;
  if (provider.autonomous_allowed === false) return false;
  if (provider.human_required === true && provider.autonomous_allowed !== true) return false;
  return ACTIONABLE.has(provider.integration_status);
}

/**
 * Capability needs → ranked providers. Fail-closed on unknown rights, unpaid
 * licensed tools, missing secrets, and framework mismatch. Never throws when
 * every provider is unavailable. Security selections never carry taste fields.
 */
export function resolveToolPlan({ needs = [], project = {}, entitlements = [], secrets = {}, catalog = [] } = {}) {
  const normalizedNeeds = uniqueSorted(needs);
  const projectFrameworks = uniqueSorted(project.frameworks ?? []);
  const ranked = [];
  const excluded = [];
  const seenExclude = new Set();

  const exclude = (provider, code, reason) => {
    const key = `${provider.provider_id}:${code}`;
    if (seenExclude.has(key)) return;
    seenExclude.add(key);
    excluded.push({ provider_id: provider.provider_id, code, reason });
  };

  for (const provider of catalog) {
    if (!provider?.provider_id) continue;
    const matched = capabilityIds(provider).filter((capability) => normalizedNeeds.includes(capability));
    if (matched.length === 0) continue;

    if (!frameworkCompatible(provider, projectFrameworks)) {
      exclude(provider, 'KINETIC_TOOL_FRAMEWORK_INCOMPATIBLE', 'provider frameworks do not satisfy the project');
      continue;
    }
    if (CLOSED_RIGHTS.has(provider.rights_status)) {
      exclude(provider, 'KINETIC_TOOL_RIGHTS_UNKNOWN', 'rights-unknown or unverified sources fail closed');
      continue;
    }
    if (PAID.has(provider.cost_class) && !hasEntitlement(provider, entitlements)) {
      exclude(provider, 'KINETIC_TOOL_PAID_NO_ENTITLEMENT', 'paid provider has no recorded entitlement');
      continue;
    }
    if (!hasSecret(provider, secrets)) {
      exclude(provider, 'KINETIC_TOOL_SECRET_MISSING', `missing secret ${provider.secret_name ?? '(unnamed)'}; engine continues without this provider`);
      continue;
    }
    if (isResearchOnly(provider)) {
      exclude(provider, 'KINETIC_TOOL_RESEARCH_NOT_INSTALLABLE', 'research providers cannot be installed as component code');
    }
    ranked.push(selection(provider, matched));
  }

  ranked.sort(compareSelections);
  excluded.sort(compareExcluded);

  const installable = ranked
    .filter((row) => {
      const provider = catalog.find((item) => item.provider_id === row.provider_id);
      return isInstallableComponent(provider);
    })
    .map((row) => ({ ...row }));

  const suggestions = ranked
    .filter((row) => row.integration_status === 'not-connected')
    .map((row) => ({ ...row }));

  const securityProviders = uniqueSorted(
    catalog
      .filter((provider) => capabilityIds(provider).includes('security.application') && normalizedNeeds.includes('security.application'))
      .filter((provider) => frameworkCompatible(provider, projectFrameworks))
      .filter((provider) => hasSecret(provider, secrets))
      .filter((provider) => !CLOSED_RIGHTS.has(provider.rights_status))
      .map((provider) => provider.provider_id),
  );

  return {
    schema: PLAN_SCHEMA,
    needs: normalizedNeeds,
    project: { frameworks: projectFrameworks },
    ranked,
    installable,
    suggestions,
    excluded,
    security: {
      influences_taste: false,
      lifecycle_stage: 'after_build',
      providers: securityProviders,
    },
  };
}
