import { AliasEntry, DetectedEntity, EntityType } from "./types";

export const buildAliasMap = (
  entities: DetectedEntity[],
): Record<string, AliasEntry> => {
  // Counters are scoped to this invocation — no cross-call bleed
  const counters: Record<EntityType, number> = {
    PERSON: 0,
    EMAIL: 0,
    URL: 0,
    MENTION: 0,
    ORG: 0,
  };

  // Reverse map: original value → alias (O(1) dupe check)
  const valueToAlias = new Map<string, string>();
  const aliasMap: Record<string, AliasEntry> = {};

  for (const entity of entities) {
    const key = `${entity.type}:::${entity.value}`;
    if (valueToAlias.has(key)) {
      continue;
    }

    counters[entity.type] += 1;
    const alias = `${entity.type}_${counters[entity.type]}`;

    valueToAlias.set(key, alias);
    aliasMap[alias] = {
      alias,
      original: entity.value,
      type: entity.type,
    };
  }

  return aliasMap;
};
