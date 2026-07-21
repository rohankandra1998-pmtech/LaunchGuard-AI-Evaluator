export const criterionFieldLimits = {
  name: 100,
  category: 100,
  description: 300,
  good_definition: 300,
  average_definition: 300,
  bad_definition: 300
} as const;

export type SuggestedCriterionInput = {
  name: string;
  category: string;
  description: string;
  good_definition: string;
  average_definition: string;
  bad_definition: string;
};

export type CriterionField = keyof SuggestedCriterionInput;
export type CriterionValidationErrors = Partial<Record<CriterionField, string>>;

const requiredFields: Array<Exclude<CriterionField, "category">> = [
  "name",
  "description",
  "good_definition",
  "average_definition",
  "bad_definition"
];

const fieldLabels: Record<CriterionField, string> = {
  name: "Name",
  category: "Category",
  description: "Description",
  good_definition: "Good definition",
  average_definition: "Average definition",
  bad_definition: "Bad definition"
};

export function normalizeCriterionName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function trimCriterion(input: SuggestedCriterionInput): SuggestedCriterionInput {
  return {
    name: input.name.trim(),
    category: input.category.trim(),
    description: input.description.trim(),
    good_definition: input.good_definition.trim(),
    average_definition: input.average_definition.trim(),
    bad_definition: input.bad_definition.trim()
  };
}

export function validateCriterion(input: SuggestedCriterionInput): CriterionValidationErrors {
  const errors: CriterionValidationErrors = {};
  const trimmed = trimCriterion(input);

  for (const field of requiredFields) {
    if (!trimmed[field]) errors[field] = `${fieldLabels[field]} is required.`;
  }

  for (const field of Object.keys(criterionFieldLimits) as CriterionField[]) {
    if (input[field].length > criterionFieldLimits[field]) {
      errors[field] = `${fieldLabels[field]} must be ${criterionFieldLimits[field]} characters or fewer.`;
    }
  }

  return errors;
}

export function parseCriterionInput(value: unknown): SuggestedCriterionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Each criterion must be an object.");
  }

  const record = value as Record<string, unknown>;
  const input = Object.fromEntries(
    (Object.keys(criterionFieldLimits) as CriterionField[]).map((field) => {
      const fieldValue = record[field];
      if (typeof fieldValue !== "string") throw new Error(`${fieldLabels[field]} must be text.`);
      return [field, fieldValue];
    })
  ) as SuggestedCriterionInput;
  const errors = validateCriterion(input);
  const firstError = (Object.keys(criterionFieldLimits) as CriterionField[]).map((field) => errors[field]).find(Boolean);
  if (firstError) throw new Error(firstError);
  return trimCriterion(input);
}
