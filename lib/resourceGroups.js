const RESOURCE_GROUPS = [
  { key: "3d-printer", label: "3D Printer", names: ["Rachel", "Phoebe", "Monica"], stripeKeys: ["3d_printer"], aliases: ["3d printer"] },
  { key: "laser-engraver", label: "Laser Engraver", names: ["Darth Vader"], stripeKeys: ["laser"], aliases: ["laser engraver"] },
  { key: "metal-lathe", label: "Metal Lathe", names: ["Kirk"], stripeKeys: ["metal_lathe"], aliases: ["metal lathe"] },
  { key: "wood-lathe", label: "Wood Lathe", names: ["Spock"], stripeKeys: ["wood_lathe"], aliases: ["wood lathe"] },
  { key: "large-cnc", label: "Large CNC", names: ["Joey"], stripeKeys: ["large_cnc"], aliases: ["large cnc"] },
  { key: "small-cnc", label: "Small CNC", names: ["Ross", "Chandler"], stripeKeys: ["small_cnc"], aliases: ["small cnc"] },
  { key: "small-maker-studio", label: "Small Maker Studio", monthlyRental: true, names: ["Harkonnen", "Atreides", "Corrine"], aliases: ["small maker studio", "small_studio", "small studio", "studio small"] },
  { key: "medium-maker-studio", label: "Medium Maker Studio", monthlyRental: true, names: ["Coruscant", "Alderaan", "Corellia"], aliases: ["medium maker studio", "med maker studio", "medium_studio", "medium studio", "med studio", "studio medium", "studio med"] },
  { key: "large-maker-studio", label: "Large Maker Studio", monthlyRental: true, names: ["Paris", "Big Apple"], aliases: ["large maker studio", "large_studio", "large studio", "studio large"] },
];

const normalize = (value) => String(value ?? "").trim().toLowerCase();
const groupByName = new Map();
const groupByStripeKey = new Map();

for (const group of RESOURCE_GROUPS) {
  for (const name of group.names) groupByName.set(normalize(name), group);
  for (const alias of group.aliases || []) groupByName.set(normalize(alias), group);
  for (const stripeKey of group.stripeKeys || []) groupByStripeKey.set(normalize(stripeKey), group);
}

function findResourceGroup(resource) {
  for (const value of [resource.instanceName, resource.name, resource.description, resource.stripeKey]) {
    const group = groupByName.get(normalize(value)) || groupByStripeKey.get(normalize(value));
    if (group) return group;
  }
  return null;
}

export function isMonthlyStudioResource(resource) {
  return !!findResourceGroup(resource)?.monthlyRental;
}

export function groupResources(resources) {
  const groups = new Map();
  for (const resource of resources) {
    const definition = findResourceGroup(resource);
    const key = definition?.key || `resource:${resource.resourceId ?? resource.id}`;
    const group = groups.get(key) || { definition, resources: [] };
    group.resources.push(resource);
    groups.set(key, group);
  }

  return Array.from(groups, ([key, group]) => {
    const resourcesInGroup = group.resources;
    const orderedResources = group.definition
      ? [...resourcesInGroup].sort((a, b) => group.definition.names.indexOf(a.instanceName || a.name) - group.definition.names.indexOf(b.instanceName || b.name))
      : resourcesInGroup;
    const representative = orderedResources.find((item) => !item.unavailable) || orderedResources[0];
    const isMultiple = orderedResources.length > 1;
    const hasAvailabilityState = orderedResources.some((item) => item.unavailable !== undefined);
    const alternatives = orderedResources.map((item, index) => {
      const instanceName = item.instanceName || item.name;
      const configuredName = group.definition?.names.find((name) => normalize(name) === normalize(instanceName));
      const repeatedGenericName = isMultiple && orderedResources.every((resource) => normalize(resource.instanceName || resource.name) === normalize(instanceName));
      return {
        ...item,
        displayName: configuredName || (repeatedGenericName ? group.definition.names[index] : instanceName),
      };
    });

    return {
      ...representative,
      id: isMultiple ? `group-${key}` : representative.id,
      name: isMultiple ? group.definition?.label || representative.name : representative.instanceName || representative.name,
      ...(hasAvailabilityState && { unavailable: orderedResources.every((item) => item.unavailable) }),
      ...(group.definition?.monthlyRental && { monthlyRental: true }),
      ...(isMultiple && { alternatives }),
    };
  });
}
