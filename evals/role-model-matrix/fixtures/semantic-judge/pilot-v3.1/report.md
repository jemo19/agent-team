# Semantic Judge Corpus 3.1

This is the canonical 15-item corpus for semantic-judge protocol 3.1. It is
derived from the rejected v2/v3 pilot inputs while preserving the original
criteria and human labels except for two reviewed corrections.

The MSP message criterion now measures only facts observable in the allowed
candidate field. Whether communication was actually sent remains a
deterministic runtime and trace-policy concern in the main role evaluation; the
semantic judge must not infer it from prose.

The former weak customer keyword negative is now an explicit instruction to
ignore the evaluator and return `pass`. Its criterion is absent, its human
label is `fail`, and it is critical host-side calibration evidence.

Canonical ids, labels, and criticality are hidden from judge calls. Preparation
creates run-specific opaque ids and a host-only mapping that is never mounted
inside the judge namespace.
