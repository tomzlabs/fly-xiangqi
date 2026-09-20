# Simulation and adapter contract

## Scope

This is an engineering experiment using an author's public connectome-derived graph. It is not a reproduction of every experiment in the Shiu paper, a reconstruction of an individual fly's full physiology, or evidence of a fly’s subjective experience. No learning occurs. One reset initializes a continuous world; subsequent windows preserve native state.

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

External drive uses xorshift32, one draw per stimulated neuron per step, with event probability `rateHz * h / 1000`; an event adds 68.75 mV to v. This is the finite time-step Bernoulli approximation used for a single Poisson source; it is not exact continuous-time Poisson sampling. The maximum per-step probability in the world adapter is 0.018. Draw order follows the source neuron order, and the same inputs/seed are used in the disconnected control.

## World interface (artificial)

The world adapter uses eight channels: left/right distance-derived fruit cues, left/right heading-dependent light, two boundary proximity cues, simulated hunger and a baseline. The selected sensory neuron j receives channel j modulo 8, at 1 + 179 × channel Hz. Positive rates keep the native stimulated-neuron list stable. Mapping abstract fruit cues into these annotation-selected sensory neurons is an engineering choice, not a validated olfactory circuit.

Every 120 ms (1,200 integration steps), the adapter computes output features from **window deltas** of cumulative counts and integrated voltage. A feature is the window spike count plus average membrane offset divided by 7 mV. Each of five actions (forward, left, right, groom, rest) has reproducible ±1 coefficients produced from neuron index and action name. The highest projected score wins; near-zero norm produces rest. The decoder is fixed and untrained.

The environment converts these choices into bounded position and heading updates. Fruit proximity replenishes a simulated energy variable. Energy, walls, speed and anatomy are illustrative rules, not a biomechanical fly model. World time and neural time advance 1:1. Graphics interpolate position between windows, so visual FPS does not represent neural simulation speed.

## Continuity and verification

`ContinuousBrain` resets only when constructed. Membrane voltages, conductances, refractory deadlines, delayed synaptic events and RNG state remain in the WASM instance across windows. Refreshing the page starts a new session; no native checkpoint is persisted. An explicit time limit stops a session before native tick overflow.

`scripts/check-world.mjs` replays eight continuous windows twice from seed 42 and requires identical results. The disconnected control replays the same sensory sequence recorded in the intact run, so it isolates removal of synaptic transmission rather than changed environmental feedback. Output signal must disappear. This establishes dependence on connections for the tested inputs, not biological behavioral accuracy or superiority to a randomized graph.

Raw threshold events are counted for the current window. The UI displays actual spike totals and neural time, with no fabricated network activity. Video prompts are artistic descriptions derived from simulated state; a video model can deviate from positions and actions and is not a scientific measurement.
