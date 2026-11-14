/** @type {import('next').NextConfig} */
const isDockerBuild = process.env.DOCKER_BUILD === "1";

module.exports = {
  // The Docker image runs a small self-contained server; Vercel uses its own output.
  output: isDockerBuild ? "standalone" : undefined,
  poweredByHeader: false,
  experimental: {
    staleTimes: { dynamic: 0 }, // the browser never reuses an old copy of a page
    serverComponentsExternalPackages: ["mongodb"],
  },
};
