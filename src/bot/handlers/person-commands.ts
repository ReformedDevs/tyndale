import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from "discord.js";

import {
  buildPersonDisambiguationEmbed,
  buildPersonEmbed,
  buildPersonNotFoundEmbed,
} from "../../people/format.js";
import type { ChurchPeopleLookup } from "../../people/lookup.js";
import type { ChurchPersonEntry } from "../../people/types.js";

export interface PersonCommandDeps {
  churchPeople: ChurchPeopleLookup;
}

export async function handlePersonAutocomplete(
  interaction: AutocompleteInteraction,
  deps: PersonCommandDeps,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "query") {
    await interaction.respond([]);
    return;
  }

  const matches = deps.churchPeople.autocomplete(String(focused.value));
  await interaction.respond(
    matches.map((person) => ({
      name: `${person.name} (${deps.churchPeople.formatCategoryLabels(person)})`.slice(
        0,
        100,
      ),
      value: person.name.slice(0, 100),
    })),
  );
}

export async function handlePersonCommand(
  interaction: ChatInputCommandInteraction,
  deps: PersonCommandDeps,
): Promise<void> {
  const query = interaction.options.getString("query", true);
  const matches = deps.churchPeople.search(query);

  if (matches.length === 0) {
    await interaction.reply({ embeds: [buildPersonNotFoundEmbed(query)] });
    return;
  }

  const exactMatch = matches.find((person) => isExactMatch(query, person));
  if (exactMatch) {
    await interaction.reply({
      embeds: [buildPersonEmbed(exactMatch, deps.churchPeople)],
    });
    return;
  }

  if (matches.length > 1) {
    await interaction.reply({
      embeds: [
        buildPersonDisambiguationEmbed(
          query,
          matches.slice(0, 5),
          deps.churchPeople,
        ),
      ],
    });
    return;
  }

  await interaction.reply({
    embeds: [buildPersonEmbed(matches[0]!, deps.churchPeople)],
  });
}

function isExactMatch(query: string, person: ChurchPersonEntry): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return [person.name, ...person.aliases].some(
    (candidate) => candidate.trim().toLowerCase() === normalizedQuery,
  );
}
