// Minimal ambient declarations so TypeScript in Codespaces stops complaining.
declare const Deno: {
  env: { get(name: string): string | undefined };
};
