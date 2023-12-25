export class Renderer {
  constructor(
    private templateFuncs: Record<
      string,
      (arg?: string) => string | Promise<string>
    >,
  ) {}

  async renderTemplate(
    template: string,
  ) {
    for (const match of [...template.matchAll(/\$\{([a-zA-Z0-9_]+)\}/g)]) {
      const [_, key] = match;
      if (!(key in this.templateFuncs)) {
        throw new Error(`Unknown template function: ${key}`);
      }

      template = template.replace(match[0], await this.templateFuncs[key]());
    }

    for (
      const match of [
        ...template.matchAll(/\$\{([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)\}/g),
      ]
    ) {
      const [_, key, value] = match;
      if (!(key in this.templateFuncs)) {
        throw new Error(`Unknown template function: ${key}`);
      }

      template = template.replace(
        match[0],
        await this.templateFuncs[key](value),
      );
    }

    return template;
  }
}
