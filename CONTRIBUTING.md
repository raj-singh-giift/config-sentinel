# Contributing to config-sentinel

## Getting started

```bash
git clone https://github.com/raj-singh-giift/config-sentinel.git
cd config-sentinel
npm install
npm run build
npm test
```

## Development workflow

- `npm run dev` — watch mode, rebuilds on change
- `npm test` — run all tests
- `npm run lint` — TypeScript type check
- `npm run test:watch` — tests in watch mode

## Project structure

```
src/
  loaders/        # env / json / js config file parsers
  core/
    loader.ts     # orchestrates all loaders
    scanner.ts    # AST scanner (ts-morph)
    validator.ts  # cross-references defined vs used keys
    typegen.ts    # TypeScript .d.ts generator
  reporters/      # terminal + JSON output
  cli/            # commander CLI commands
  sentinel.ts     # library API entry point
  types.ts        # all shared types
tests/
  fixtures/       # sample project used by tests
  loader.test.ts
  scanner.test.ts
  validator.test.ts
```

## Making changes

1. Fork the repo and create a branch from `main`
2. Write tests for any new behaviour before implementing
3. Run `npm test` — all 16 tests must pass
4. Run `npm run lint` — no TypeScript errors
5. Open a pull request against `main`

## Adding a new config source type

1. Create `src/loaders/<type>.loader.ts` — export `load<Type>File(filePath, accessor?): Promise<ConfigKey[]>`
2. Register it in `src/core/loader.ts` in the `routeByExtension` switch
3. Add at least 2 tests in `tests/loader.test.ts`
4. Add the extension to the source types table in `README.md`

## Reporting bugs

Open an issue at https://github.com/raj-singh-giift/config-sentinel/issues with:
- Node.js version
- A minimal `sentinel.config.js` that reproduces the issue
- The file/line that was incorrectly flagged or missed

## Known limitations

See the [Known limitations](README.md#known-limitations) section in the README before opening an issue — type cast chain breaks and dynamic keys are intentional constraints.
