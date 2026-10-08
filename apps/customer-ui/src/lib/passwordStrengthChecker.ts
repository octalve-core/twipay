export const uppercase = /[A-Z]/;

export const getPasswordConditions = (password: string = "") => {
  return {
    minLength: password.length >= 8,
    hasUppercase: uppercase.test(password),
  };
};

export const getStrengthScore = (conditions: ReturnType<typeof getPasswordConditions>) => {
  return Object.values(conditions).filter(Boolean).length;
};

export const getStrengthColor = (score: number) => {
  switch (score) {
    case 1:
      return "#FFC324"; // Weak
    case 2:
      return "#4ADE80"; // Strong
    default:
      return "#FFFBFA"; // Default
  }
};
