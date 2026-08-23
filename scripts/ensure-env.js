#!/usr/bin/env node
/**
 * Гарантирует наличие корректного .env перед стартом фронтенда.
 * Кроссплатформенная (Node), вызывается из start.sh / start.ps1.
 *
 *   1. Если .env отсутствует — копирует его из .env.example.
 *   2. Если в .env нет VITE_API_URL — дописывает значение по умолчанию.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

function main() {
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log("[env] .env отсутствовал — создан из .env.example");
    } else {
      fs.writeFileSync(envPath, "");
      console.log("[env] .env отсутствовал — создан пустым");
    }
  }

  let content = fs.readFileSync(envPath, "utf8");
  const hasVar = /^VITE_API_URL=/m.test(content);
  // Пустое значение (VITE_API_URL= без значения) тоже считаем «не задано».
  const hasValue = /^VITE_API_URL=.+/m.test(content);

  if (!hasVar) {
    if (content.length && !content.endsWith("\n")) content += "\n";
    content += "VITE_API_URL=http://localhost:8000\n";
    fs.writeFileSync(envPath, content);
    console.log("[env] Добавлен VITE_API_URL=http://localhost:8000");
  } else if (!hasValue) {
    content = content.replace(/^VITE_API_URL=.*$/m, "VITE_API_URL=http://localhost:8000");
    fs.writeFileSync(envPath, content);
    console.log("[env] VITE_API_URL был пуст — установлен http://localhost:8000");
  } else {
    console.log("[env] VITE_API_URL уже задан в .env");
  }
}

main();
