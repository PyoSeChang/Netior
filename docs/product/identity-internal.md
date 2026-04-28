# Netior Identity Notes

## Purpose

This document is an internal working note for describing Netior's identity and direction.
It is not a final specification.
Some claims here are convictions, and some are active hypotheses that still need to be tested through development.

## Current Position

Netior is currently closer to an editor than a full work environment.
Its nearest comparison points are VS Code and Obsidian.
However, Netior is not trying to become either a development-only IDE or a document-centric PKM tool.

The long-term direction is larger:

- a knowledge editor
- an agent-friendly work environment
- eventually, a system that feels closer to an operating layer for knowledge work

The network Netior works with is not a static node-link diagram.
It is a working structure that guides exploration for both humans and AI.
The point is not to display a graph, but to build a network that helps decide what to inspect, what to follow, and which viewpoint should be activated now.

## Core Thesis

Netior is an integrated knowledge interface for humans and AI.

The important part of "integration" is not feature bundling.
It is reducing the translation cost between:

- Human -> Netior -> AI
- AI -> Netior -> Human

Today, it is hard for humans to place their thinking onto the computer in a usable structure.
It is also hard to place computer-resident information into a form that an agent can actually work with.
Netior exists as an intermediate layer for that translation.
More precisely, it aims to become an interface through which humans and AI can read and update the same network in different ways.

## Problem Recognition

### Folder and tree structures are computer-friendly, not thought-friendly

Folders and trees are efficient for storage and deterministic lookup.
But they impose a fixed address structure on knowledge.
That is useful for computers and often misaligned with human cognition.

The working assumption behind Netior is:

> Relation is primary.

Human thought is not experienced as a fixed address hierarchy.
Meaning is activated through association, context, and relational structure.

### Existing graph views do not solve this

A graph view that shows thousands of dots and edges is not useful by itself.
The problem is not the absence of visible links.
The problem is that link existence alone does not provide a usable causal model or a working context.

Obsidian-like graph views can still be useful as visualizations of accumulated links.
But if the user has to maintain the graph as a separate cognitive task, the graph does not become the actual interface of work.
The network Netior aims for should not be a static artifact maintained after the fact.
It should be something that is continuously generated, revised, and rearranged through use.

What matters is not the total amount of connection, but which set of relations should be activated in a specific situation.

Reference is only one kind of relation.
A large link graph does not tell an agent what matters for the current task.
It does not explain why a senior engineer can often debug better than an agent with access to the same codebase.

The working answer is:

- the senior has a causal model
- the senior knows what to ignore
- the senior can choose the right viewpoint for the task

Netior should help externalize and route that kind of structure.

## Network As Exploration Guide

In Netior, the network is not just a visualization of stored results.
It is a guide over the exploration space.

For humans, the network helps determine:

- which relation set should be activated now
- what to inspect and what to ignore
- which viewpoint should be used to reframe the problem

For AI, the network helps determine:

- which objects and relations should be explored first
- where the task boundary should be drawn
- which causal model should organize reasoning

The same network therefore becomes a surface for thought for the human and a routing structure for search and reasoning for the agent.

## Why Canvas, For Now

Canvas is not treated as a complete answer.
It is currently the best available direction compared with tree-first interfaces.

The reason is modest but important:

- tree structures force a fixed hierarchy
- canvas at least leaves room for relational arrangement
- canvas makes viewpoint changes and rearrangement more natural than folders

This is still an open area.
Netior does not yet claim to have fully discovered the right canvas-native UX.
The UI burden is actually higher than a file explorer because the responsibility is larger:

- node placement matters
- relation handling matters
- viewpoint switching matters
- scale and readability matter

## Personal Knowledge Ontology

Netior aims toward personal knowledge ontology, not just note collection.

This ontology should be:

- interpretable by agents
- not fully rigid
- capable of evolving with the project
- domain-independent in principle

The important point is not to force perfect formalization.
An overly deterministic schema could undermine the actual goal.
The target is an interpretable but flexible structure.

In Netior, schemas, relation types, concepts, and canvas structure are expected to evolve over time.
The network is not static, and a model where only the human manually maintains it is not enough.
Agents may eventually participate in proposing, revising, and maintaining that evolution.

## Context

One of the most important emerging concepts is context.

Current working definition:

> Context is a subset of the total relation space.

If many objects exist, the total set of possible relations becomes too large to use directly.
In real work, what matters is not the whole relation space but the subset of relations that should be activated for a specific task, viewpoint, or objective.
Put differently: what matters is not relation volume, but which relation set is activated in context.

This makes context important for at least three reasons:

- it constrains what an agent should inspect
- it enables the same objects to be reorganized under different viewpoints
- it helps preserve upper-level structure while changing lower-level implementation details

This is not just about token savings, though token efficiency matters.
It is also about quality.
Without a context mechanism, agents lack the metacognition needed to decide where to look and how broadly to reason.

Open questions remain:

- Is context a first-class object, a computed result, or both?
- How does context relate to canvas?
- What minimum semantics should an edge carry?

## AI and Dynamic Prompting

Netior's AI direction is not "attach more files to chat."
The stronger hypothesis is dynamic prompting through ontology and context.

Agents are weak when they lack:

- the right causal model
- the right viewpoint
- the right task boundary

If a human expert can provide that structure explicitly, agent performance can change significantly.
Netior should make that structure reusable rather than forcing the user to restate it manually every time.

In this sense, Netior is trying to become a system for structured dynamic prompting, grounded in concepts, relations, and contexts.

## Engineering Methods Applied To Knowledge Work

A major long-term ambition is to bring software engineering methods into general knowledge production.

Examples already implied by the vision:

- validation
- modularization
- dependency reasoning
- structured decomposition
- replaceable lower-level implementations under stable higher-level structure

This applies beyond software projects.
The same framing could matter for fiction, learning, research, journaling, and planning, as long as the domain can develop its own ontology.

## Domain Independence and Extensibility

Domain independence is not a small claim.
It means more than "usable in many fields."
It points toward a system where behavior can change depending on the ontology the user has built.

That implies multiple forms of extensibility:

- feature extensibility
- ontology extensibility
- agent/tool extensibility

This is difficult by definition.
But it is central to the direction.

## What Feels Stable Right Now

The following claims currently appear stable enough to reuse in future writing:

- Netior is a knowledge interface between human and AI, not just a canvas app.
- Netior's network is not a static graph but an exploration guide for both human and AI.
- Folder/tree systems are efficient for storage but weak for relational knowledge work.
- The key issue is not relation count but which relation set is activated in context.
- Existing graph views fail because they visualize links without providing causal models or task-aware routing.
- The goal is not graph maintenance itself, but making the network evolve through use.
- Personal knowledge ontology is a central goal.
- Agent usefulness depends on better context selection and better structure transfer.
- Network creation and maintenance should eventually be shared between human and agent.
- The system should remain flexible rather than collapsing into a fully rigid schema.

## What Is Still Open

The following areas are still exploratory and should be described carefully in outward-facing documents:

- the final role of canvas
- the formal status of context
- the semantics of edges
- the human/agent division of responsibility
- the concrete shape of multi-agent workflows

## Condensed One-Paragraph Version

Netior is an evolving attempt to build an integrated knowledge interface between humans and AI. It starts from the belief that folder and tree structures are efficient for computers but poorly matched to human relational thinking, and that existing graph views still fail because they expose links without supplying causal models, task boundaries, or usable context. Netior therefore aims beyond note-taking or visualization toward a living knowledge network: a flexible but agent-interpretable structure of concepts, relations, and contexts that can guide exploration for both humans and AI, evolve through use rather than manual graph upkeep, and eventually support dynamic prompting, better routing, validation, and domain-independent knowledge work.
