# Coding conventions

## Control flow — always use blocks

All control flow statements (`if`, `else`, `for`, `while`, `do`) must use curly braces, even for single-line bodies.

```ts
// Bad
if (condition) return

// Good
if (condition) {
  return
}
```

```ts
// Bad
for (const x of xs) doSomething(x)

// Good
for (const x of xs) {
  doSomething(x)
}
```

## Arrow functions — omit blocks when possible

Arrow functions whose body is a single expression should use the implicit-return form (no curly braces, no `return` keyword).

```ts
// Bad
const fn = () => {
  doSomething()
}

// Good
const fn = () => doSomething()
```

## Type / schema definitions — place after imports

All `interface`, `type`, and Zod schema definitions must appear immediately after the import block, before any runtime code.

## Error messages — be specific

When throwing for a missing CLI flag vs. a missing value, use distinct messages so the caller knows which part is wrong.
