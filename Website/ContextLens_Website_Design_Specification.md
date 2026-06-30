# ContextLens Documentation & Product Website Design Specification

# Vision

The website should feel like a modern developer platform rather than a
marketing landing page.

Primary inspirations:

-   Stripe Documentation
-   Vercel
-   Linear
-   GitHub
-   Cloudflare
-   Anthropic
-   Raycast

Avoid:

-   Excessive animations
-   Bright gradients everywhere
-   Generic AI artwork
-   Stock photos
-   Marketing-heavy copy

The design should communicate engineering quality, trust, and clarity.

------------------------------------------------------------------------

# Brand Personality

Visual keywords:

-   Minimal
-   Professional
-   Technical
-   Fast
-   Intelligent
-   Clean
-   Premium
-   Developer-first

Mood:

"An engineering tool built by engineers."

------------------------------------------------------------------------

# Color Palette

Background

-   Near Black (#0B0D10)

Surface

-   #111418

Cards

-   #171B20

Accent

-   Electric Blue
-   Cyan
-   Soft Purple

Status Colors

-   Green
-   Amber
-   Red

Typography

-   White
-   Soft Gray
-   Muted Gray

------------------------------------------------------------------------

# Typography

Headings

-   Inter
-   Geist
-   Space Grotesk

Body

-   Inter
-   IBM Plex Sans

Code

-   JetBrains Mono

------------------------------------------------------------------------

# Website Structure

Home

Documentation

API Reference

MCP Tools

Resources

Prompts

Examples

SDK

CLI

Roadmap

Blog

Community

GitHub

------------------------------------------------------------------------

# Home Page Layout

Hero Section

Left:

Large heading

"Persistent developer context for AI."

Supporting paragraph explaining ContextLens in one sentence.

Primary CTA

-   Install Extension

Secondary CTA

-   Read Documentation

Right:

Interactive 3D visualization.

------------------------------------------------------------------------

# Hero 3D Illustration

Theme:

Developer Context Network

Imagine:

A floating dark cube representing the developer workspace.

Around it:

-   Git
-   VS Code
-   Claude
-   Cursor
-   Gemini
-   Terminal
-   Docker
-   GitHub

Each appears as glowing nodes.

Thin animated lines connect every node to the central cube.

Occasionally:

Small packets of light travel between nodes.

This represents context synchronization.

Camera slowly rotates.

------------------------------------------------------------------------

# Scroll Animation

As the user scrolls

The camera zooms inward.

The floating cube opens.

Inside appears

-   repository
-   files
-   commits
-   embeddings
-   memories
-   timeline

Each layer expands smoothly.

------------------------------------------------------------------------

# Architecture Section

Replace text-heavy explanations with an interactive architecture
diagram.

Layers:

AI Clients

↓

MCP Bridge

↓

ContextLens Platform

↓

AI Engine

↓

Workspace

↓

Git

↓

Database

Hovering over a layer highlights it and shows a concise description.

------------------------------------------------------------------------

# Features Section

Display as a grid of engineering capability cards.

Examples

-   Semantic Search
-   Episode Tracking
-   AI Memory
-   Git Intelligence
-   MCP Integration
-   Prompt Library
-   Context Resources
-   Timeline Replay

Each card includes:

-   Minimal line icon
-   Short description
-   Animated hover border

------------------------------------------------------------------------

# Timeline Visualization

Illustrate the lifecycle of an episode.

Start Episode

↓

Code

↓

Git Changes

↓

AI Calls

↓

Snapshots

↓

Review

↓

Close Episode

Represented as a horizontal interactive timeline.

------------------------------------------------------------------------

# Interactive Demo

Allow users to simulate:

Search:

"authentication bug"

Display:

-   Relevant episode
-   Git diff
-   AI explanation
-   Files changed

This can be powered by mock data.

------------------------------------------------------------------------

# Documentation Experience

Left Sidebar

-   Sticky navigation

Center

-   Documentation

Right Sidebar

-   Table of contents
-   Edit page
-   Copy link

Code blocks

-   Copy button
-   Line highlighting
-   Dark theme

------------------------------------------------------------------------

# API Explorer

Every tool should have:

Purpose

Input schema

Output schema

Permissions

Version

Example request

Example response

------------------------------------------------------------------------

# MCP Explorer

Interactive table

Columns:

Name

Category

Permission

Version

Description

Searchable and filterable.

------------------------------------------------------------------------

# Visual Assets

Avoid stock photography.

Create custom illustrations.

Required illustrations:

-   Developer Workspace
-   Context Graph
-   AI Memory Graph
-   Repository Timeline
-   MCP Request Flow
-   Search Pipeline
-   Embedding Pipeline
-   Plugin Architecture

Style:

Minimal isometric vector.

Dark background.

Thin glowing outlines.

------------------------------------------------------------------------

# 3D Models

Model 1

Developer Context Core

A floating cube with illuminated edges.

Inside:

Moving particles representing context.

------------------------------------------------------------------------

Model 2

Repository Galaxy

Files orbit a repository core.

Commits appear as satellites.

Branches split naturally.

------------------------------------------------------------------------

Model 3

Knowledge Graph

Nodes connected with glowing edges.

Search queries illuminate matching paths.

------------------------------------------------------------------------

Model 4

AI Bridge

Represent the MCP bridge as a glowing conduit between AI clients and
ContextLens.

------------------------------------------------------------------------

# Motion Design

Animations should be subtle.

Examples:

-   Slow floating
-   Opacity fades
-   Smooth scaling
-   Node pulse
-   Connection glow

Avoid:

-   Large parallax
-   Excessive rotations
-   Bounce animations

------------------------------------------------------------------------

# Iconography

Use simple outline icons.

Examples:

Git

Database

Brain

Search

Timeline

Cloud

Workspace

Folder

Terminal

Memory

------------------------------------------------------------------------

# Screenshots

Prepare polished screenshots for:

-   Dashboard
-   Episode timeline
-   Semantic search
-   AI review
-   MCP settings
-   Documentation

Wrap screenshots in realistic browser/device frames.

------------------------------------------------------------------------

# Community Page

Display:

Contributors

Release history

Roadmap

Discussions

Sponsors (future)

------------------------------------------------------------------------

# Footer

Sections:

Documentation

Resources

Community

GitHub

License

Privacy

Security

Status

------------------------------------------------------------------------

# Technical Stack

Frontend

-   Next.js
-   React
-   TypeScript

Styling

-   Tailwind CSS
-   shadcn/ui

Animation

-   Framer Motion

3D

-   React Three Fiber
-   Drei

Documentation

-   Fumadocs or Docusaurus

Search

-   Pagefind or Algolia DocSearch

Analytics

-   Plausible

Hosting

-   Vercel

------------------------------------------------------------------------

# Accessibility

Requirements

-   WCAG AA
-   Keyboard navigation
-   Reduced motion support
-   High contrast mode
-   Semantic HTML
-   Screen reader support

------------------------------------------------------------------------

# Success Criteria

A visitor should understand within 30 seconds:

1.  What ContextLens is.
2.  Why persistent developer context matters.
3.  How MCP integrates with their AI tools.
4.  How to install it.
5.  Where to find documentation.
6.  That the project is actively maintained and production-ready.
