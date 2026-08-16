const REQUIRED = "v22.13.0";

if (process.version !== REQUIRED) {
  console.error(
    `Node ${REQUIRED} is required. Current version: ${process.version}`,
  );
  process.exit(1);
}
