"""Independent Brian2 parity check of signed, delayed, refractory propagation.

Run: python -m pip install brian2; python scripts/verify_brian2.py
This validates the numerical core on a four-neuron circuit, not the full paper's
experimental conclusions or the artificial chess adapter.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from brian2 import (NeuronGroup, Synapses, SpikeGeneratorGroup, SpikeMonitor,
                    Network, defaultclock, prefs, mV, ms)

ROOT=Path(__file__).resolve().parents[1]
d=json.loads(subprocess.check_output(['node','scripts/toy-trial.mjs'],cwd=ROOT))
prefs.codegen.target='numpy'
defaultclock.dt=0.1*ms
state=d['seed']
times=[]
for step in range(d['steps']):
    state ^= (state << 13) & 0xffffffff
    state ^= state >> 17
    state ^= (state << 5) & 0xffffffff
    if state/4294967296 < d['rate']*0.1/1000:
        times.append(step*0.1)

neurons=NeuronGroup(d['n'], '''
dv/dt = (-52*mV - v + g)/(20*ms) : volt (unless refractory)
dg/dt = -g/(5*ms) : volt (unless refractory)
rfc : second
''', threshold='v > -45*mV', reset='v=-52*mV; g=0*mV', refractory='rfc', method='linear')
neurons.v=-52*mV
neurons.rfc=2.2*ms
neurons.rfc[0]=0*ms
synapses=Synapses(neurons,neurons,'w : volt',on_pre='g_post += w',delay=1.8*ms)
synapses.connect(i=d['pre'],j=d['post'])
synapses.w=np.array(d['weights'])*0.275*mV
source=SpikeGeneratorGroup(1,np.zeros(len(times),dtype=int),np.array(times)*ms)
input_syn=Synapses(source,neurons,on_pre='v_post += 68.75*mV')
input_syn.connect(i=0,j=0)
monitor=SpikeMonitor(neurons)
Network(neurons,synapses,source,input_syn,monitor).run(d['steps']*0.1*ms)
observed=np.c_[np.rint(monitor.t/ms/0.1).astype(int),np.asarray(monitor.i)].ravel()
assert np.array_equal(observed,d['events']), 'Spike timestamps or neuron identities differ from Brian2'
assert np.allclose(neurons.v/mV,d['voltage'],atol=1e-9,rtol=0), 'Membrane state differs from Brian2'
report={'reference':'Brian2 exact linear integration','neurons':d['n'],'durationMs':d['steps']*0.1,
        'spikeEvents':int(len(observed)//2),'counts':list(map(int,monitor.count)),
        'spikeTimesIdentical':True,'voltageMaxAbsErrorMv':float(np.max(np.abs(neurons.v/mV-d['voltage']))),
        'scope':'Four-neuron excitation/inhibition/delay/refractory circuit; does not validate full-brain biological fidelity.'}
(ROOT/'docs/brian2-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
