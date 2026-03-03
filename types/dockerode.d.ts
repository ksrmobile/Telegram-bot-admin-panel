declare module "dockerode" {
  // Minimal typing to satisfy TypeScript during Next.js build.
  // The project uses Dockerode in a fairly simple way, so `any` is acceptable here.
  const Docker: any;
  export default Docker;
}

