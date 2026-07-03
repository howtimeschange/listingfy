#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { buildDeepdrawSdkClasspath } from "./lib/deepdraw_sdk_adapter.mjs";

const MAVEN_DEPENDENCIES = [
  "com.alibaba:fastjson:1.2.76",
  "commons-logging:commons-logging:1.2",
  "org.apache.httpcomponents:httpclient:4.5.13",
  "org.apache.httpcomponents:httpcore:4.4.14",
  "commons-codec:commons-codec:1.15",
  "org.apache.commons:commons-lang3:3.11",
  "commons-collections:commons-collections:3.2.2",
  "commons-io:commons-io:2.4",
  "org.apache.commons:commons-collections4:4.1",
  "com.google.guava:guava:20.0",
  "org.slf4j:slf4j-api:1.7.25",
  "com.squareup.okhttp3:okhttp:3.8.1",
  "com.squareup.okio:okio:1.13.0",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
  }
  return result;
}

function hasCommand(command) {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  return result.status === 0;
}

function requireCommand(command, hint) {
  if (!hasCommand(command)) {
    throw new Error(`${command} is required for DeepDraw SDK publishing. ${hint}`);
  }
}

function prepareMavenDependencies(projectRoot) {
  let classpath = buildDeepdrawSdkClasspath({ projectRoot });
  if (classpath.missing.length === 0) return classpath;

  requireCommand("mvn", "Install Maven or pre-populate the configured Maven repository.");
  const localRepo = process.env.DEEPDRAW_M2_REPOSITORY
    ? [`-Dmaven.repo.local=${path.resolve(process.env.DEEPDRAW_M2_REPOSITORY)}`]
    : [];
  for (const dependency of MAVEN_DEPENDENCIES) {
    console.log(`Fetching DeepDraw SDK dependency: ${dependency}`);
    run("mvn", ["-q", ...localRepo, "dependency:get", `-Dartifact=${dependency}`], { stdio: "inherit" });
  }

  classpath = buildDeepdrawSdkClasspath({ projectRoot });
  if (classpath.missing.length > 0) {
    throw new Error(`DeepDraw SDK runtime jars are still missing: ${classpath.missing.join(", ")}`);
  }
  return classpath;
}

function main() {
  const projectRoot = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, ".."));
  requireCommand("java", "Install a JRE/JDK in the API runtime.");
  requireCommand("javac", "Install a JDK, not only a JRE, because the adapter compiles small Java bridge classes.");
  run("java", ["-version"]);
  run("javac", ["-version"]);
  const classpath = prepareMavenDependencies(projectRoot);
  console.log(`DeepDraw SDK runtime ready: ${classpath.entries.length} classpath entries`);
}

main();
