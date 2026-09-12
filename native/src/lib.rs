//! Dense membrane updates + event-driven CSR propagation. Units: mV and ms.
//! This is a documented Shiu-style LIF implementation, not a biological fly.
use std::cell::RefCell;

const DT: f64 = 0.1;
const REST: f64 = -52.0;
const THRESHOLD: f64 = -45.0;
const DELAY: usize = 18;
const REFRACTORY: u32 = 22;

pub struct Brain {
    n: usize,
    offsets: Vec<u32>,
    targets: Vec<u32>,
    weights: Vec<i16>,
    voltage: Vec<f64>,
    conductance: Vec<f64>,
    refractory_until: Vec<u32>,
    rates: Vec<f32>,
    driven: Vec<usize>,
    counts: Vec<u32>,
    integrated: Vec<f64>,
    queue: Vec<Vec<u32>>,
    events: Vec<u32>,
    tick: u32,
    rng: u32,
    transmission: bool,
}

impl Brain {
    pub fn new(n: usize, offsets: Vec<u32>, targets: Vec<u32>, weights: Vec<i16>) -> Self {
        Self { n, offsets, targets, weights, voltage: vec![REST; n],
            conductance: vec![0.; n], refractory_until: vec![0; n], rates: vec![0.; n],
            driven: vec![], counts: vec![0; n], integrated: vec![0.; n],
            queue: (0..=DELAY).map(|_| Vec::new()).collect(), events: vec![],
            tick: 0, rng: 1, transmission: true }
    }

    fn parse(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < 12 || &bytes[..4] != b"FLY1" { return None; }
        let u32_at = |p| u32::from_le_bytes(bytes[p..p+4].try_into().unwrap());
        let n = u32_at(4) as usize;
        let m = u32_at(8) as usize;
        if n == 0 || n > 1_000_000 || m > 100_000_000 { return None; }
        if bytes.len() != 12 + (n + 1) * 4 + m * 6 { return None; }
        let offsets: Vec<_> = (0..=n).map(|i| u32_at(12+i*4)).collect();
        if offsets[0] != 0 || offsets[n] as usize != m || offsets.windows(2).any(|w| w[0]>w[1]) { return None; }
        let start = 12 + (n + 1) * 4;
        let targets: Vec<_> = (0..m).map(|i| u32_at(start+i*4)).collect();
        if targets.iter().any(|&i| i as usize >= n) { return None; }
        let start = start + m * 4;
        let weights = (0..m).map(|i| i16::from_le_bytes(bytes[start+i*2..start+i*2+2].try_into().unwrap())).collect();
        Some(Self::new(n, offsets, targets, weights))
    }

    pub fn reset(&mut self, seed: u32, transmission: bool) {
        self.voltage.fill(REST); self.conductance.fill(0.); self.refractory_until.fill(0);
        self.rates.fill(0.); self.driven.clear(); self.counts.fill(0); self.integrated.fill(0.);
        for q in &mut self.queue { q.clear(); }
        self.events.clear(); self.tick = 0; self.rng = seed.max(1); self.transmission = transmission;
    }

    pub fn drive(&mut self, i: usize, rate: f32) {
        if i >= self.n || !rate.is_finite() || rate < 0. || rate > 1000. { return; }
        if self.rates[i] == 0. && rate > 0. { self.driven.push(i); }
        self.rates[i] = rate;
    }

    pub fn advance(&mut self, steps: u32) {
        self.events.clear();
        let am = (-DT / 20.).exp();
        let ag = (-DT / 5.).exp();
        let coupling = (am - ag) / 3.;
        let mut fired = Vec::new();
        for _ in 0..steps {
            fired.clear();
            // Exact linear update between events. Refractory states are frozen.
            for i in 0..self.n {
                if self.tick < self.refractory_until[i] { continue; }
                self.voltage[i] = REST + (self.voltage[i]-REST)*am + self.conductance[i]*coupling;
                self.conductance[i] *= ag;
                if self.voltage[i] > THRESHOLD {
                    fired.push(i as u32);
                    self.counts[i] += 1;
                    self.events.extend_from_slice(&[self.tick, i as u32]);
                }
            }
            // Thresholds precede synaptic arrivals, then external input, then reset.
            let slot = self.tick as usize % (DELAY + 1);
            if self.transmission {
                for &source in &self.queue[slot] {
                    for e in self.offsets[source as usize]..self.offsets[source as usize + 1] {
                        let j = self.targets[e as usize] as usize;
                        if self.tick >= self.refractory_until[j] {
                            self.conductance[j] += self.weights[e as usize] as f64 * 0.275;
                        }
                    }
                }
            }
            self.queue[slot].clear();
            for &i in &self.driven {
                // Explicit xorshift32: identical seed/stimulus -> identical trial.
                self.rng ^= self.rng << 13; self.rng ^= self.rng >> 17; self.rng ^= self.rng << 5;
                if (self.rng as f64 / 4294967296.) < self.rates[i] as f64 * DT / 1000. {
                    self.voltage[i] += 68.75;
                }
            }
            let future = (self.tick as usize + DELAY) % (DELAY + 1);
            for &i in &fired {
                let i = i as usize;
                self.voltage[i] = REST; self.conductance[i] = 0.;
                self.refractory_until[i] = self.tick + if self.rates[i] > 0. { 0 } else { REFRACTORY };
                if self.transmission { self.queue[future].push(i as u32); }
            }
            // Readout includes subthreshold activity. No board features enter here.
            for i in 0..self.n { self.integrated[i] += self.voltage[i] - REST; }
            self.tick += 1;
        }
    }
}

thread_local! {
    static INPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    static BRAIN: RefCell<Option<Brain>> = const { RefCell::new(None) };
}

#[no_mangle]
pub extern "C" fn allocate_input(len: usize) -> *mut u8 {
    INPUT.with(|b| { let mut b=b.borrow_mut(); *b=vec![0; len]; b.as_mut_ptr() })
}
#[no_mangle]
pub extern "C" fn load_graph() -> u32 {
    INPUT.with(|input| {
        let mut input=input.borrow_mut();
        let parsed=Brain::parse(&input);
        *input=Vec::new();
        if let Some(brain)=parsed { let n=brain.n; BRAIN.with(|b| *b.borrow_mut()=Some(brain)); n as u32 } else { 0 }
    })
}
#[no_mangle]
pub extern "C" fn reset(seed: u32, transmission: u32) { BRAIN.with(|b| b.borrow_mut().as_mut().unwrap().reset(seed, transmission!=0)); }
#[no_mangle]
pub extern "C" fn set_drive(i: u32, hz: f32) { BRAIN.with(|b| b.borrow_mut().as_mut().unwrap().drive(i as usize, hz)); }
#[no_mangle]
pub extern "C" fn advance(steps: u32) { BRAIN.with(|b| b.borrow_mut().as_mut().unwrap().advance(steps.min(5000))); }
#[no_mangle]
pub extern "C" fn counts_ptr() -> *const u32 { BRAIN.with(|b| b.borrow().as_ref().unwrap().counts.as_ptr()) }
#[no_mangle]
pub extern "C" fn integral_ptr() -> *const f64 { BRAIN.with(|b| b.borrow().as_ref().unwrap().integrated.as_ptr()) }
#[no_mangle]
pub extern "C" fn voltage_ptr() -> *const f64 { BRAIN.with(|b| b.borrow().as_ref().unwrap().voltage.as_ptr()) }
#[no_mangle]
pub extern "C" fn events_ptr() -> *const u32 { BRAIN.with(|b| b.borrow().as_ref().unwrap().events.as_ptr()) }
#[no_mangle]
pub extern "C" fn events_len() -> u32 { BRAIN.with(|b| b.borrow().as_ref().unwrap().events.len() as u32) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_passive_membrane_solution() {
        let mut b=Brain::new(1,vec![0,0],vec![],vec![]);
        b.voltage[0]=-48.; b.advance(100);
        assert!((b.voltage[0]-(REST+4.*(-0.5_f64).exp())).abs()<1e-10);
    }
    #[test]
    fn exact_synaptic_solution() {
        let mut b=Brain::new(1,vec![0,0],vec![],vec![]);
        b.conductance[0]=1.; b.advance(100);
        let expected=REST+((-0.5_f64).exp()-(-2.0_f64).exp())/3.;
        assert!((b.voltage[0]-expected).abs()<1e-10);
    }
    #[test]
    fn delay_and_signed_transmission() {
        for weight in [100,-100] {
            let mut b=Brain::new(2,vec![0,1,1],vec![1],vec![weight]);
            b.voltage[0]=-44.; b.advance(19);
            assert_eq!(b.voltage[1],REST);
            b.advance(1);
            assert_eq!((b.voltage[1]-REST).is_sign_positive(), weight>0);
        }
    }
    #[test]
    fn severing_edges_prevents_downstream_response_and_seed_repeats() {
        let mut b=Brain::new(2,vec![0,1,1],vec![1],vec![200]);
        b.reset(123,true); b.drive(0,500.); b.advance(1000);
        let counts=b.counts.clone(); let events=b.events.clone(); assert!(counts[1]>0);
        b.reset(123,true); b.drive(0,500.); b.advance(1000);
        assert_eq!(events,b.events); assert_eq!(counts,b.counts);
        b.reset(123,false); b.drive(0,500.); b.advance(1000);
        assert_eq!(counts[0],b.counts[0]); assert_eq!(b.counts[1],0); assert_eq!(b.voltage[1],REST);
    }
    #[test]
    fn zero_input_is_quiescent() {
        let mut b=Brain::new(2,vec![0,1,1],vec![1],vec![200]); b.advance(1000);
        assert!(b.events.is_empty()); assert_eq!(b.voltage,vec![REST;2]);
    }
    #[test]
    fn rejects_malformed_graphs() {
        assert!(Brain::parse(b"bad").is_none());
        let mut bytes=b"FLY1".to_vec();
        for i in [2_u32,1,0,1,1,2] { bytes.extend(i.to_le_bytes()); }
        bytes.extend(1_i16.to_le_bytes()); assert!(Brain::parse(&bytes).is_none());
    }
}
