// Silences chatty dev logging in production builds. `console.warn` and
// `console.error` are kept so real problems still surface (and reach any crash
// reporter you wire up later). Imported once, at the very top of App.js.
if (!__DEV__) {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
}
