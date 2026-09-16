#!/usr/bin/env zx

// CONFIGURE TARGETS — each entry is a full image path: registry/[namespace/]name
const TARGETS = [
  "ghcr.io/boonpin/wa-chat-flow",
];

const LOCAL_TAG = "wa-chat-flow:local";
// -----------------

const [, , , ...PARAMS] = process.argv;

const options = {};
PARAMS.filter(v => v.startsWith("--")).forEach(v => {
  const [key, value] = `${v}`.substring(2).trim().split("=");
  options[key] = value === undefined ? true : value;
});

if (options.verbose) {
  $.verbose = true;
}

console.log("received options:");
Object.keys(options).forEach(k => console.log(`\t * ${k}:${options[k]}`));
console.log("");

// Resolve which targets to push to:
//   --target=img1,img2  → only those targets (can be full paths not in TARGETS)
//   (no --target)       → all entries in TARGETS
const pushTargets = options.target
  ? options.target.split(",").map(t => t.trim())
  : TARGETS;

const now = new Date();
const GIT_REVISION = `${await quiet($`git rev-parse HEAD`)}`.trim();
const HOSTNAME = `${await quiet($`hostname`)}`.trim();
const BUILD_DATE = now.toISOString();
const BUILD_NUMBER = now.toISOString()
  .replace(/[-:T]/g, '')  // remove -, :, and T
  .slice(2, 12); // get yymmddhhmm

// --------------------------------
console.log(`>> building ${LOCAL_TAG} image ....`);
console.log(`\t * HOSTNAME:${HOSTNAME}`);
console.log(`\t * GIT_REVISION:${GIT_REVISION}`);
console.log(`\t * BUILD_DATE:${BUILD_DATE}`);
console.log(`\t * BUILD_NUMBER:${BUILD_NUMBER}`);

// --------------------------------
console.time(`>> build time`);
const HOME = process.env.HOME;
// --platform=linux/amd64 to build for a VPS from an Apple Silicon Mac.
// Without it the image matches the builder, and a mismatched one dies on the
// server with "exec format error".
const platformArgs = options.platform ? ['--platform', options.platform] : [];

await $`docker build \
  --secret id=npmrc,src=${HOME}/.npmrc \
  ${platformArgs} \
  --build-arg BUILD_DATE=${BUILD_DATE}  \
  --build-arg GIT_REVISION=${GIT_REVISION}  \
  --build-arg BUILDER_HOSTNAME=${HOSTNAME} \
  --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
  -t ${LOCAL_TAG} -f Dockerfile .`;


if (options.push) {
  const tags = options.tag?.split(",") || ['latest'];
  for (const target of pushTargets) {
    for (const tag of tags) {
      const remoteImg = `${target}:${tag}`;
      console.log(`>> pushing image ${remoteImg} ...`);
      await $`docker tag ${LOCAL_TAG} ${remoteImg}`;
      await $`docker push ${remoteImg}`;
      await $`docker rmi ${remoteImg}`;
    }
  }
}

console.log();
console.timeEnd(`>> build time`);
console.log(`>> finished build: ${LOCAL_TAG} at [${new Date().toISOString()}]`)
