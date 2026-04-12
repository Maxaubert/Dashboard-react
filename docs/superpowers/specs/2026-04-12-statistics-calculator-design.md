# Statistics Calculator Design Spec

## Overview

Add a **Statistics mode** to the existing calculator tool, toggled via a pill switch. The scientific calculator remains the default. Both modes receive visual refinements (better spacing, larger targets, cleaner typography). The statistics mode provides 22 functions across 4 categories, each showing step-by-step formulas with the user's actual numbers substituted in.

**Target user:** Intermediate/applied statistics student preparing for exams (ANOVA, regression, hypothesis testing, probability distributions).

## Architecture

### File Structure

```
src/pages/tools/
  ToolCalculatorPage.tsx          ~120 lines — page shell, pill toggle, mode switching

src/components/calculator/
  ScientificCalculator.tsx        ~200 lines — refactored current calculator with visual polish
  StatsCalculator.tsx             ~250 lines — button grid + expanding form container
  StatsGrid.tsx                   ~80 lines  — the 21-function button grid with category headers
  StatsForm.tsx                   ~120 lines — dynamic form that adapts inputs/labels per function
  FormulaDisplay.tsx              ~120 lines — step-by-step formula renderer

src/lib/
  statistics.ts                   ~300 lines — pure math, all 21 functions
```

### Data Flow

```
User Input (dataset or form fields)
  → StatsForm.tsx (parses, validates)
  → statistics.ts: compute(fn, inputs) → { result, steps: FormulaStep[] }
  → FormulaDisplay.tsx (renders formula + substituted numbers + result)
```

Each stat function returns `{ result: number | Record<string, number>, steps: FormulaStep[] }`. Simple functions return a single number. Multi-output functions (e.g., ANOVA returns F, p, SSB, SSW, df_between, df_within) return a record. The steps array drives the formula display, decoupling UI from math.

## Visual Refinements (Both Modes)

Changes apply to the scientific calculator and carry through to the stats mode:

| Property | Before | After |
|----------|--------|-------|
| Keypad grid | 8 columns | 6 columns |
| Button padding | 7px | 11px |
| Input/output padding | 10px | 14-16px |
| Input text size | 14px (1.2rem) | 16px |
| Result text size | 16px (1.55rem) | 20px |
| Button text size | 11px (0.88rem) | 14px |
| Border radius | 4-6px | 8-10px |
| Button background | #08080a | #0c0c10 |
| Gap | 5px | 6px |

### Mode Toggle

Pill/segmented control above the input area:
- `[Scientific | Statistics]` — Scientific is active by default
- Active state: amber background (#f59e0b), black text
- Inactive state: transparent, muted text
- Compact: fits inline, doesn't take much vertical space

## Statistics Mode

### Layout: Button Grid + Expanding Form

All 22 functions displayed as labeled buttons in a flat grid, organized by category with subtle uppercase group headers. Clicking a button expands an inline form below the grid for that function. Only one form open at a time.

### Functions by Category

**Descriptive (5 functions)**
Grid: Mean | Median | Var | Std Dev | Range

All take a single comma-separated dataset input.

**Distributions (6 functions)**
Grid: Norm Z | t | χ² | F | Binom | Poisson

- Normal Z: z-value + direction (left/right/two-tail), or inverse mode (probability → z)
- t: test statistic + df + direction, or inverse (probability + df → critical t)
- χ²: test statistic + df + direction, or inverse (probability + df → critical χ²)
- F: test statistic + df1 + df2 + direction, or inverse (probability + df1 + df2 → critical F)
- Binomial: n, p, k + mode (exact P(X=k) / cumulative P(X≤k))
- Poisson: λ, k + mode (exact / cumulative)

**Hypothesis Tests (6 functions)**
Grid: z-test | 1-samp t | 2-samp t | Paired t | ANOVA | p-value

- z-test: x̄, μ₀, σ, n, tail direction
- One-sample t-test: x̄, μ₀, s, n, tail
- Two-sample t-test (Welch's, unequal variances assumed): Summary mode (x̄₁, s₁, n₁, x̄₂, s₂, n₂) OR Raw Data mode (two datasets). Toggle between modes.
- Paired t-test: Two side-by-side dataset fields (Sample 1, Sample 2) + tail selector
- ANOVA: Stacked group inputs with add/remove. Minimum 2 groups. Each group is a comma-separated dataset. Result displays a full ANOVA table (SSB, SSW, df_between, df_within, MSB, MSW, F-statistic, p-value).
- p-value calculator: test statistic + distribution type dropdown + df + tail

**Regression (5 functions)**
Grid: LSR Line | r | R² | Predict | Res. SE

All take side-by-side x and y value fields. Predict also takes an x₀ input for prediction.

### Form Input Patterns

| Pattern | Used by | Layout |
|---------|---------|--------|
| Single dataset | Descriptive stats (all 5) | One textarea |
| Single value + params | Distributions (all 6) | Labeled fields in a row |
| Summary stats | z-test, 1-samp t, 2-samp t (summary mode) | Labeled fields grouped per sample |
| Dual dataset | Paired t, 2-samp t (raw mode), Regression (all 5) | Side-by-side textareas |
| Multi-group | ANOVA | Stacked rows with add/remove |

Tail direction selector: pill toggle with Left | Two | Right options.

Two-sample t-test has a Summary/Raw Data toggle in the form header.

### Formula Display

Step-by-step breakdown for every function:

1. **FORMULA** — generic formula with symbols (e.g. `s² = Σ(xᵢ - x̄)² / (n-1)`)
2. **SUBSTITUTED** — actual numbers plugged in, showing intermediate calculations
3. **RESULT** — final answer, large amber text

Example for variance with dataset [12, 15, 18, 22, 25, 30, 31, 28]:
```
FORMULA
s² = Σ(xᵢ − x̄)² / (n − 1)

SUBSTITUTED
x̄ = (12+15+18+22+25+30+31+28) / 8 = 22.625
s² = [(12−22.625)² + (15−22.625)² + ... + (28−22.625)²] / 7
   = [112.89 + 58.14 + 21.39 + 0.39 + 5.64 + 54.39 + 70.14 + 28.89] / 7
   = 351.875 / 7

RESULT
s² = 50.268
```

## Dependencies

**New:** `jstat` (or `jstat-esm`) — lightweight statistics library (~15KB gzipped) for distribution CDF and inverse CDF lookups. Used only for probability calculations (Normal, t, χ², F, Binomial, Poisson CDFs) where reimplementing would be error-prone.

**Existing:** `mathjs` — continues to power the scientific calculator mode. Not used in stats mode.

## Error Handling

- **Empty/invalid input:** Inline validation below each field. No result computed until all required fields are valid.
- **Mismatched dataset lengths:** Paired t-test and regression check both datasets have the same count. Message: "Datasets must have the same number of values (got 5 and 4)"
- **Too few values:** Variance/stddev need n ≥ 2. t-tests need n ≥ 2. ANOVA needs ≥ 2 groups with ≥ 2 values each. Clear message stating the minimum.
- **Division by zero / undefined:** Zero variance in a t-test, etc. Show descriptive message rather than NaN/Infinity.
- **Parsing:** Accept comma-separated, space-separated, or mixed. Ignore trailing commas/spaces. Non-numeric values highlighted in red.

## Out of Scope

- No graphing or visualization
- No saved history for stats mode
- No confidence interval functions
- No chi-square GoF/independence tests
- No combinatorics (nCr, nPr, Bayes)
