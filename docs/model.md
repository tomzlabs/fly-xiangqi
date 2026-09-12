# Simulation and adapter contract

## Scope

This is an engineering experiment using an author's public connectome-derived graph. It is not a reproduction of every experiment in the Shiu paper, a reconstruction of an individual fly's full physiology, or evidence that a fly understands chess. No learning occurs during play. Reset per trial is intentional and part of the versioned contract.

## Network

`public/data/connectome.bin.gz` decompresses to a little-endian binary:

- 4 bytes `FLY1`, followed by `u32 neuron_count`, `u32 edge_count`.
- `u32 offsets[neuron_count+1]`, `u32 targets[edge_count]`, `i16 signed_synapse_counts[edge_count]`.
- For source i, edges are `offsets[i] .. offsets[i+1]`.

Every author edge is retained. Original data is indexed by `Completeness_783.csv`; importer verifies both root ID columns against the indices before packaging. Runtime counts are multiplied by 0.275 mV; no extra connection normalization or random edges.

`neurons.json.gz` contains exact 64-bit root IDs as decimal strings, sensory indices and output indices. `neurons.bin.gz` contains N×3 float32 anchor coordinates, then N uint8 display group codes, then N uint8 coordinate-valid flags. IDs must never be converted to JS Number.

## Equations and scheduler

For membrane potential v and synaptic state g, with potentials in mV and time in ms:

```
dv/dt = (-52 - v + g) / 20
dg/dt = -g / 5
```

During each h = 0.1 ms step, eligible neurons use the exact update:

```
am = exp(-h/20); ag = exp(-h/5)
v = -52 + (v+52)*am + g*(am-ag)/3
g = g*ag
```

Order is membrane integration → threshold detection `v > -45` → due synaptic arrival → seeded external stimulus → spike resets. Synaptic arrival adds signed synapse count × 0.275 to g, except that arrival to refractory neurons is discarded. A spike resets v to −52 and g to zero, schedules outgoing events 18 steps later, and holds ordinary neurons refractory until spike step + 22. Stimulated neurons have zero refractory period, matching the reference's activation convention. Both v and g are frozen while refractory. The chosen operation order is independently compared with Brian2 on a controlled circuit.

External drive uses xorshift32, one draw per stimulated neuron per step, with event probability `rateHz * h / 1000`; an event adds 68.75 mV to v. This is the finite time-step Bernoulli approximation used for a single Poisson source; it is not exact continuous-time Poisson sampling. The maximum per-step probability in the chess adapter is 0.018. Draw order follows the source neuron order, and the same inputs/seed are used in the disconnected control.

## Chess interface (artificial)

Square index is file + 8×(rank−1), channel is square×12 + piece type (`pnbrqk`) + 0 for side to move / 6 for opponent. Visual sensory neuron number j in the annotation-selected list receives channel j mod 768. Only occupied channels are stimulated at 180 Hz. This is an artificial injection into visual sensory neurons, not a fly visual model, not natural image processing, and not a biological retinal map.

Output is restricted to annotations `descending` and `motor`. Those indices are disjoint from the input set. Feature i is spike count i plus the time-average of `(v_i+52)/7`. The voltage average includes all post-event states in the trial and includes negative subthreshold effects.

For each legal UCI action, `rankMoves` generates a reproducible ±1 coefficient for each output neuron with a fixed integer mixing function and projects the feature vector onto those coefficients, normalized by sqrt(output count). No coefficient is learned. This arbitrary decoder often produces poor chess; no ELO, expertise, or evolved chess knowledge is implied. It also means the action mapping is not biologically meaningful. With near-zero feature norm, no action is selected. Ties are resolved by ascending UCI string, explicitly outside the neural model.

Chess.js provides legality and game termination. There is no direct board-evaluation feature, no stockfish process, no opening lookup, no search tree, and no mate-in-one override. All scored action preferences depend on the output feature vector.

## Telemetry and intervention

Every threshold crossing is recorded as `[step, neuron_index]`. Chunks are posted every 50 steps and visualized as bright points at corresponding real anchor positions. No synthetic activity or random waiting pulses are added. Playback is explicitly labelled as replay; visual fading is illustrative, not a membrane-state estimate. The static point cloud includes quiescent neurons.

The disconnect control sets transmission to false, resets the model, and repeats exactly the same FEN, seed, duration and drive channels. Input neurons still fire; outgoing edges do not deliver current. Output signal should disappear because outputs are not directly driven. This establishes dependence on connectivity for that trial. It does not establish that the biological graph beats a random graph or a board-only model. Shuffled-graph controls and trained readout evaluations remain future work.

Reports include graph and WASM SHA-256, exact adapter/model version, source manifest, stimulus channels, output features, action scores and the complete threshold event list. `scripts/verify-record.mjs` recomputes a downloaded trial and checks event-level equality. The test is numerical reproducibility, not an independent biological validation.
