export const recipes = [
  {
    name: "hello",
    mods: [{ name: "hello", from: "repo" }],
    apply({ layout, options }: { layout: { floating?: unknown[] }; options: Record<string, unknown> }) {
      layout.floating = [...(layout.floating ?? []), { id: "hello", content: { mod: "hello", props: { greeting: options.greeting ?? null } }, edge: "left", align: "end" }];
    },
  },
];
