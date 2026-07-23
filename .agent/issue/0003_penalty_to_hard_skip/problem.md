# Problem: Penalty → hard skip for source diversity

The old linear soft penalty (`sourceCount * 0.01` or `0.12 × diversityStrength` for over-cap) was too weak. Even at high sourceCount, the penalty was small enough that a strongly-preferred feed could still dominate 6-8 slots in the recommended list.
