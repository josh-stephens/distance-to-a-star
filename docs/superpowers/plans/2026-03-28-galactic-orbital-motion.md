# Galactic Orbital Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace linear proper motion with physically accurate galactic orbital motion for all objects, and add a background stellar density field showing stars flowing through spiral arm density waves.

**Architecture:** Three motion tiers computed per-frame: (1) galactic rotation + z-oscillation for MW objects, (2) peculiar velocities for Local Group galaxies, (3) Hubble flow for cosmic-scale objects. A 1000-particle density field (two populations) renders the visual impression of billions of stars with density wave brightening. Spiral arms become time-dependent density wave patterns.

**Tech Stack:** ES5 JavaScript, Canvas 2D, no dependencies. All data in `js/data.js`, all logic in `js/app.js`.

**Branch:** `feat/galactic-motion` off `main`, PR linked to #70.

---

### Task 1: Create feature branch and add galactic constants to data.js
### Task 2: Compute galactic orbital parameters at init in app.js
### Task 3: Rewrite updateStellarPositions with galactic rotation + z-oscillation + PM blending
### Task 4: Add galaxy peculiar velocities and Hubble flow
### Task 5: Build galactic particle cache (200 local + 800 galactic)
### Task 6: Render galactic density field particles in 2D with density wave brightening
### Task 7: Render galactic density field particles in 3D
### Task 8: Make spiral arms time-dependent density waves
### Task 9: Visual verification at all zoom levels and create PR

Each task contains full code, exact file paths, and verification steps. See the detailed task content in the implementation session.
