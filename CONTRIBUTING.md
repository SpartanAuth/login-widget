# Contributing to SpartanAuth Login Widget

## Code Style

### Promise Chains vs async/await

This project uses **promise chains** (`.then()` / `.catch()` / `.finally()`) as the preferred pattern for async network code. Please do **not** refactor promise chains into `async/await + try/catch` unless specifically asked to.

Example of the preferred style:
```typescript
function doSomething() {
  return fetch('/api/endpoint', { method: 'POST', ... })
    .then(response => {
      if (response.ok) return response.json();
      throw new Error('Request failed');
    })
    .then(data => {
      // handle success
    })
    .catch((err: Error) => {
      setErrorMessage(err.message);
    });
}
```

#### Loading State Pattern

When a user action should disable UI while a network call is in flight, use the `isSubmitting` signal with `.finally()`:

```typescript
// In the event handler:
setIsSubmitting(true);
doSomething().finally(() => setIsSubmitting(false));

// In JSX:
<button type="submit" disabled={isSubmitting()}>
  {isSubmitting() ? 'Loading...' : 'Submit'}
</button>
```

Key rules:
- Each network function must **return** its promise chain so that `.finally()` can be chained by the caller.
- Handle errors internally inside each function via `setErrorMessage` (inside `.catch()`), rather than re-throwing and propagating to the caller.
- The caller only needs `.finally(() => setIsSubmitting(false))` — no `.catch()` required if the function handles errors itself.
