import { randomUUID } from "node:crypto";

const PLUGIN_ID = "app.dibao.webhook";
const RULES_KEY = "rules";
const EVENTS = [
  "article.created",
  "article.updated",
  "article.actionRecorded",
  "feed.refreshCompleted",
  "ranking.afterRanked",
  "settings.afterUpdated",
  "plugin.taskSucceeded",
  "plugin.taskFailed",
  "dailyBrief.generated"
];
const OPERATORS = new Set(["equals", "contains", "exists"]);
const METHODS = new Set(["GET", "POST"]);

export default {
  activate(ctx) {
    for (const eventName of EVENTS) {
      ctx.hooks.on(eventName, async (event) => {
        await handleEvent(ctx, eventName, event);
      });
    }

    ctx.api.get("/state", () => state(ctx));

    ctx.api.post("/rules", ({ body }) => {
      const current = readRules(ctx);
      const rule = normalizeRule(body);
      writeRules(ctx, [rule, ...current]);
      return state(ctx);
    });

    ctx.api.post("/rules/:id", ({ params, body }) => {
      const current = readRules(ctx);
      const existing = current.find((rule) => rule.id === params.id);
      if (!existing) {
        throw httpError(404, "Webhook rule not found");
      }
      const next = normalizeRule({ ...existing, ...objectValue(body), id: existing.id });
      writeRules(ctx, current.map((rule) => rule.id === existing.id ? next : rule));
      return state(ctx);
    });

    ctx.api.post("/rules/:id/test", async ({ params, body }) => {
      const rule = readRules(ctx).find((candidate) => candidate.id === params.id);
      if (!rule) {
        throw httpError(404, "Webhook rule not found");
      }
      const input = objectValue(body);
      const eventName = stringValue(input.eventName) || rule.eventName;
      const event = objectValue(input.event);
      const delivery = await dispatchRule(ctx, rule, eventName, {
        ...sampleEvent(eventName),
        ...event,
        test: true
      }, { force: true, test: true });
      return { delivery, state: state(ctx) };
    });

    ctx.api.post("/rules/:id/delete", ({ params }) => {
      writeRules(ctx, readRules(ctx).filter((rule) => rule.id !== params.id));
      return state(ctx);
    });

    ctx.api.post("/secrets/:key", ({ params, body }) => {
      const input = objectValue(body);
      const value = typeof input.value === "string" ? input.value : "";
      if (!value) {
        throw httpError(400, "Secret value is required");
      }
      return {
        secret: ctx.secrets.set(params.key, value, nullableString(input.hint)),
        state: state(ctx)
      };
    });

    ctx.api.post("/secrets/:key/delete", ({ params }) => {
      ctx.secrets.delete(params.key);
      return state(ctx);
    });
  }
};

async function handleEvent(ctx, eventName, event) {
  for (const rule of readRules(ctx)) {
    if (!rule.enabled || rule.eventName !== eventName) {
      continue;
    }
    const context = buildContext(ctx, rule, eventName, event);
    if (matchesConditions(rule.conditions, context)) {
      await dispatchRuleWithContext(ctx, rule, context, {});
    }
  }
}

async function dispatchRule(ctx, rule, eventName, event, options = {}) {
  const context = buildContext(ctx, rule, eventName, event, options);
  if (!options.force && !matchesConditions(rule.conditions, context)) {
    return null;
  }
  return await dispatchRuleWithContext(ctx, rule, context, options);
}

async function dispatchRuleWithContext(ctx, rule, context, options = {}) {
  const renderedUrl = renderString(rule.urlTemplate, context);
  if (!renderedUrl) {
    throw httpError(400, "Webhook URL is required");
  }
  const generatedAt = context.generatedAt;
  const basePayload = {
    eventName: context.eventName,
    event: context.event,
    article: context.article,
    generatedAt,
    ruleId: rule.id
  };
  const headers = renderHeaders(rule.headers, context);
  const secretHeaders = normalizeSecretHeaders(rule.secretHeaders);
  const request = {
    method: rule.method,
    url: rule.method === "GET"
      ? mergeQuery(renderedUrl, renderTemplate(rule.queryTemplate, context, { fallback: {} }))
      : renderedUrl,
    headers,
    secretHeaders,
    body: rule.method === "POST"
      ? renderTemplate(rule.bodyTemplate, context, { fallback: basePayload })
      : null,
    maxAttempts: options.test ? 1 : 5
  };
  const idempotencyKey = deliveryIdempotencyKey(rule, context, options);
  if (idempotencyKey) {
    request.idempotencyKey = idempotencyKey;
  }
  return ctx.deliveries.enqueue(request);
}

function buildContext(ctx, rule, eventName, event, options = {}) {
  const eventObject = objectValue(event);
  const articleId = stringValue(eventObject.articleId);
  const includeContent = rule.includeContent === true;
  const article = articleId
    ? ctx.articles.snapshot(articleId, { includeContent })
    : null;
  return {
    pluginId: PLUGIN_ID,
    ruleId: rule.id,
    eventName,
    event: eventObject,
    article,
    feed: article?.feed ?? (eventObject.feedId ? { id: eventObject.feedId } : null),
    generatedAt: ctx.now(),
    test: options.test === true
  };
}

function readRules(ctx) {
  const value = ctx.storage.get(RULES_KEY);
  return Array.isArray(value) ? value.map(normalizeRule).filter((rule) => rule.urlTemplate) : [];
}

function writeRules(ctx, rules) {
  ctx.storage.set(RULES_KEY, rules.map(normalizeRule));
}

function state(ctx) {
  return {
    pluginId: PLUGIN_ID,
    rules: readRules(ctx),
    secrets: ctx.secrets.list(),
    deliveries: ctx.deliveries.list({ limit: 50 }),
    events: typeof ctx.events.catalog === "function" ? ctx.events.catalog().filter((event) => EVENTS.includes(event)) : EVENTS,
    generatedAt: ctx.now()
  };
}

function normalizeRule(input) {
  const record = objectValue(input);
  const method = stringValue(record.method).toUpperCase();
  const eventName = stringValue(record.eventName);
  const id = stringValue(record.id) || `rule_${randomUUID()}`;
  return {
    id,
    name: stringValue(record.name) || "Untitled rule",
    enabled: record.enabled !== false,
    eventName: EVENTS.includes(eventName) ? eventName : EVENTS[0],
    conditions: normalizeConditions(record.conditions),
    method: METHODS.has(method) ? method : "POST",
    urlTemplate: stringValue(record.urlTemplate),
    queryTemplate: plainObject(record.queryTemplate),
    bodyTemplate: plainObject(record.bodyTemplate),
    headers: stringRecord(record.headers),
    secretHeaders: normalizeSecretHeaders(record.secretHeaders),
    includeContent: record.includeContent === true,
    updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : Date.now()
  };
}

function normalizeConditions(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((condition) => {
      const record = objectValue(condition);
      const path = stringValue(record.path);
      const operator = stringValue(record.operator);
      if (!path || !OPERATORS.has(operator)) {
        return null;
      }
      return {
        path,
        operator,
        value: record.value ?? ""
      };
    })
    .filter(Boolean);
}

function matchesConditions(conditions, context) {
  for (const condition of conditions) {
    const value = getPath(context, condition.path);
    if (condition.operator === "exists") {
      if (value === null || value === undefined || value === "") {
        return false;
      }
      continue;
    }
    if (condition.operator === "equals") {
      if (String(value ?? "") !== String(condition.value ?? "")) {
        return false;
      }
      continue;
    }
    if (condition.operator === "contains") {
      if (Array.isArray(value)) {
        if (!value.map((item) => String(item)).includes(String(condition.value ?? ""))) {
          return false;
        }
      } else if (!String(value ?? "").includes(String(condition.value ?? ""))) {
        return false;
      }
    }
  }
  return true;
}

function renderTemplate(template, context, options = {}) {
  const hasTemplate = template && typeof template === "object" && !Array.isArray(template) && Object.keys(template).length > 0;
  if (!hasTemplate) {
    return options.fallback ?? {};
  }
  return renderValue(template, context);
}

function renderValue(value, context) {
  if (typeof value === "string") {
    const exact = value.match(/^\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}$/u);
    if (exact) {
      return getPath(context, exact[1]) ?? "";
    }
    return renderString(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderValue(item, context));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, renderValue(item, context)])
    );
  }
  return value;
}

function renderString(value, context) {
  return String(value ?? "").replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/gu, (_match, path) => {
    const resolved = getPath(context, path);
    if (resolved === null || resolved === undefined) {
      return "";
    }
    if (typeof resolved === "object") {
      return JSON.stringify(resolved);
    }
    return String(resolved);
  });
}

function renderHeaders(headers, context) {
  return Object.fromEntries(
    Object.entries(headers)
      .map(([key, value]) => [key, renderString(value, context)])
      .filter(([key]) => key)
  );
}

function mergeQuery(urlText, query) {
  const url = new URL(urlText);
  for (const [key, value] of Object.entries(plainObject(query))) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function getPath(input, path) {
  let value = input;
  for (const part of String(path).split(".")) {
    if (!part) {
      return undefined;
    }
    if (value && typeof value === "object" && Object.hasOwn(value, part)) {
      value = value[part];
    } else {
      return undefined;
    }
  }
  return value;
}

function deliveryIdempotencyKey(rule, context, options) {
  if (options.test) {
    return null;
  }
  const event = context.event;
  const stableId = stringValue(event.id) || stringValue(event.eventId) || stringValue(event.jobId) || stringValue(event.articleId);
  if (!stableId) {
    return null;
  }
  return `${rule.id}:${context.eventName}:${stableId}:${stringValue(event.action)}`;
}

function sampleEvent(eventName) {
  const now = Date.now();
  if (eventName.startsWith("article.")) {
    return { articleId: "article_recommended", feedId: "feed_design", emittedAt: now };
  }
  if (eventName === "feed.refreshCompleted") {
    return { feedId: "feed_design", articleIds: [], articlesSeen: 0, refreshedAt: now };
  }
  if (eventName.startsWith("plugin.")) {
    return { pluginId: "app.dibao.example", taskId: "task.example", finishedAt: now };
  }
  return { emittedAt: now };
}

function normalizeSecretHeaders(value) {
  const output = {};
  for (const [header, input] of Object.entries(plainObject(value))) {
    const record = objectValue(input);
    const key = stringValue(record.key);
    if (!header || !key) {
      continue;
    }
    output[header] = {
      key,
      prefix: typeof record.prefix === "string" ? record.prefix : ""
    };
  }
  return output;
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function objectValue(value) {
  return plainObject(value);
}

function stringRecord(value) {
  return Object.fromEntries(
    Object.entries(plainObject(value))
      .map(([key, item]) => [stringValue(key), stringValue(item)])
      .filter(([key]) => key)
  );
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value) {
  const next = stringValue(value);
  return next || null;
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = statusCode === 404 ? "NOT_FOUND" : "VALIDATION_ERROR";
  return error;
}
