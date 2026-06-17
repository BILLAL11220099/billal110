/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSchema, CompanyProcedure, InventoryItem, ChecklistItem, NewsFeedPost } from "../types";

export interface SearchResultItem {
  id: string;
  type: "procedure" | "inventory" | "checklist" | "feed";
  title: string;       // human name of matched item
  subtitle: string;    // context info (e.g., category, status, etc.)
  snippet: string;     // matching excerpt of text with match highlighted or contextualized
  originalObject: any; // the object itself to allow edit clicks directly from search suggestions
}

/**
 * Strips HTML tags so we can search the raw content text accurately
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

const isLiquidItem = (name: string, category?: string): boolean => {
  const normName = name.toLowerCase();
  const normCat = category ? category.toLowerCase() : "";
  return (
    normCat.includes("drinks") ||
    normCat.includes("syrup") ||
    normName.includes("oil") ||
    normName.includes("drink") ||
    normName.includes("syrup") ||
    normName.includes("fanta") ||
    normName.includes("sprite") ||
    normName.includes("spite") || // Support for user's typo
    normName.includes("coke") ||
    normName.includes("cola") ||
    normName.includes("fizz") ||
    normName.includes("juice") ||
    normName.includes("milk") ||
    normName.includes("shake mix") ||
    normName.includes("liquid")
  );
};

const getItemUnit = (name: string, category?: string): string => {
  return isLiquidItem(name, category) ? "L" : "pcs";
};

/**
 * Searches across the entire database, matching text patterns, single letters, and numbers.
 * Provides granular matches with snippets.
 */
export function searchEverything(schema: AppSchema, query: string): SearchResultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResultItem[] = [];

  // 1. Search Procedures
  schema.procedures.forEach(p => {
    const titleMatch = p.title.toLowerCase().includes(q);
    const categoryMatch = p.category.toLowerCase().includes(q);
    const rawContent = stripHtml(p.content);
    const contentMatch = rawContent.toLowerCase().includes(q);

    if (titleMatch || categoryMatch || contentMatch) {
      let snippet = "";
      if (titleMatch) {
        snippet = `Title matched: "${p.title}"`;
      } else if (categoryMatch) {
        snippet = `In Category: ${p.category}`;
      } else {
        const index = rawContent.toLowerCase().indexOf(q);
        const start = Math.max(0, index - 40);
        const end = Math.min(rawContent.length, index + q.length + 40);
        snippet = "..." + rawContent.slice(start, end).trim() + "...";
      }

      results.push({
        id: p.id,
        type: "procedure",
        title: p.title,
        subtitle: `Procedure • ${p.category}`,
        snippet,
        originalObject: p
      });
    }
  });

  // 2. Search Inventory Items
  schema.inventory.forEach(item => {
    const nameMatch = item.name.toLowerCase().includes(q);
    const categoryMatch = item.category.toLowerCase().includes(q);
    const numberMatch =
      item.pcsPerInner.toString().includes(q) ||
      item.innersPerCase.toString().includes(q);

    if (nameMatch || categoryMatch || numberMatch) {
      const u = getItemUnit(item.name, item.category);
      const isLiquid = u === "L";
      const unitLabel = isLiquid ? "Liters" : "Pcs";
      const itemInnersParsed = parseInt(String(item.innersPerCase), 10);
      const isOneCase = itemInnersParsed === 1 || String(item.innersPerCase).toLowerCase().includes("bulk");
      const parsedPcs = parseFloat(String(item.pcsPerInner));
      const parsedInners = parseFloat(String(item.innersPerCase));
      const hasMathValue = !isNaN(parsedPcs) && !isNaN(parsedInners);
      const totalValText = hasMathValue 
        ? `${parsedInners * parsedPcs}` 
        : `${item.pcsPerInner} × ${item.innersPerCase}`;

      const breakdownText = isOneCase
        ? `Conversion: 1 Case = ${item.pcsPerInner} ${unitLabel}`
        : `Conversion: 1 Case = ${item.innersPerCase} ${isLiquid ? "Containers" : "Inners"} • 1 ${isLiquid ? "Container" : "Inner"} = ${item.pcsPerInner} ${item.pcsPerInner === 1 && isLiquid ? "Liter" : unitLabel} (${totalValText} total ${unitLabel})`;
      results.push({
        id: item.id,
        type: "inventory",
        title: item.name,
        subtitle: `Inventory • ${item.category}`,
        snippet: numberMatch ? `Matched numeric spec. ${breakdownText}` : breakdownText,
        originalObject: item
      });
    }
  });

  // 3. Search Checklist
  schema.checklist.forEach(chk => {
    const taskMatch = chk.task.toLowerCase().includes(q);
    const categoryMatch = chk.category.toLowerCase().includes(q);
    const completedMatch = (chk.completed ? "completed done yes" : "pending undone remaining to-do").includes(q);
    const userMatch = chk.completedBy?.toLowerCase().includes(q) || false;

    if (taskMatch || categoryMatch || completedMatch || userMatch) {
      results.push({
        id: chk.id,
        type: "checklist",
        title: chk.task,
        subtitle: `Checklist • ${chk.category}`,
        snippet: `Status: ${chk.completed ? "✓ Done" : "⏳ Pending"}${chk.completedBy ? ` by ${chk.completedBy}` : ""}`,
        originalObject: chk
      });
    }
  });

  // 4. Search Feed Post
  schema.feed.forEach(post => {
    const textMatch = post.text.toLowerCase().includes(q);
    const authorMatch = post.author.toLowerCase().includes(q);
    const roleMatch = post.role.toLowerCase().includes(q);
    const imageNameMatch = post.imageName?.toLowerCase().includes(q) || false;

    // Check comments too
    const matchedComment = post.comments?.find(cmt => 
      cmt.text.toLowerCase().includes(q) || 
      cmt.author.toLowerCase().includes(q) || 
      cmt.role.toLowerCase().includes(q)
    );

    if (textMatch || authorMatch || roleMatch || imageNameMatch || matchedComment) {
      let snippet = "";
      if (imageNameMatch && post.imageName) {
        snippet = `📸 Photo Name Matched: "${post.imageName}"${post.text ? ` — ${post.text}` : ""}`;
      } else if (matchedComment) {
        snippet = `💬 Comment by ${matchedComment.author}: "${matchedComment.text}"`;
      } else if (textMatch) {
        snippet = post.text.length > 80 ? post.text.slice(0, 80) + "..." : post.text;
      } else if (authorMatch) {
        snippet = `Post published by ${post.author} (${post.role}): "${post.text}"`;
      } else {
        snippet = `Post Match: "${post.text}"`;
      }

      results.push({
        id: post.id,
        type: "feed",
        title: `Feed post by ${post.author} (${post.role})`,
        subtitle: post.imageName ? `News Feed Update • Photo: ${post.imageName}` : "News Feed Update",
        snippet,
        originalObject: post
      });
    }
  });

  return results;
}

/**
 * Collects lightweight suggestions based on the user's keystrokes.
 * Useful for building quick suggestions dropdown.
 */
export function getQuickSuggestions(schema: AppSchema, typing: string): string[] {
  const q = typing.trim().toLowerCase();
  if (!q) return [];

  const suggestionsSet = new Set<string>();

  // Add matching elements to the completion set
  schema.procedures.forEach(p => {
    if (p.title.toLowerCase().includes(q)) suggestionsSet.add(p.title);
    if (p.category.toLowerCase().includes(q)) suggestionsSet.add(p.category);
  });

  schema.inventory.forEach(i => {
    if (i.name.toLowerCase().includes(q)) suggestionsSet.add(i.name);
    if (i.category.toLowerCase().includes(q)) suggestionsSet.add(i.category);
  });

  schema.checklist.forEach(c => {
    if (c.task.toLowerCase().includes(q)) {
      // Suggest shorter task parts
      const words = c.task.split(" ");
      const matchingWord = words.find(w => w.toLowerCase().startsWith(q));
      if (matchingWord) {
        suggestionsSet.add(matchingWord);
      } else {
        suggestionsSet.add(c.task.length > 30 ? c.task.slice(0, 30) + "..." : c.task);
      }
    }
  });

  schema.feed.forEach(f => {
    if (f.author.toLowerCase().includes(q)) suggestionsSet.add(f.author);
    if (f.text.toLowerCase().includes(q)) {
      const words = f.text.split(" ");
      const matchingWord = words.find(w => w.toLowerCase().startsWith(q));
      if (matchingWord) {
        suggestionsSet.add(matchingWord);
      } else {
        suggestionsSet.add(f.text.length > 30 ? f.text.slice(0, 30) + "..." : f.text);
      }
    }
    if (f.imageName && f.imageName.toLowerCase().includes(q)) {
      suggestionsSet.add(f.imageName);
    }
  });

  return Array.from(suggestionsSet).slice(0, 5); // Return top 5 suggestions
}
