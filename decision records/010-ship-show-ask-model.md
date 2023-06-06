# Adoption of Ship / Show / Ask Model

- Status: Accepted
- Deciders: @azlam-abdulsalam, @vuha-acn, @zhebinliu
- Date: 06/06/2023

## Context and Problem Statement

As the sfpowerscripts project evolves and the number of maintainers is not fixed, maintaining an efficient workflow for integrating changes becomes essential. Traditionally, we've been using pull request reviews as a gatekeeper for merging code into the mainline. However, this process often introduces delays and can be a bottleneck, especially for non-controversial changes like bug fixes and documentation updates.

Martin Fowler suggests an alternative branching strategy, Ship / Show / Ask, which could provide a more flexible and efficient workflow [[source](https://martinfowler.com/articles/ship-show-ask.html)]. 

This branching strategy categorizes changes into three types:

- Ship: Changes are merged into the mainline without review. This is ideal for non-controversial changes, like bug fixes and documentation updates.
- Show: Changes are opened for review via a pull request and then immediately merged into the mainline. This provides a space for feedback and discussion, but doesn't delay the introduction of the change.
- Ask: Changes are opened for review via a pull request and are only merged after discussion. This is for changes where input and agreement from the team is desired.

The Ship / Show / Ask strategy respects the principles of continuous integration and continuous delivery and encourages conversation about the code, helping to maintain a feedback culture.

## Decision

We propose to adopt the Ship / Show / Ask strategy for sfpowerscripts. This decision is based on the following considerations:

- It provides a more flexible workflow that can adapt to the nature of the changes being introduced.
- It supports the principles of continuous integration and continuous delivery.
- It encourages a culture of feedback and discussion without tying it exclusively to the pull request review process.
- It puts key maintainers in control of the lifecycle of their changes, allowing them to decide when their changes are ready to go live.

## Consequences

Adopting the Ship / Show / Ask model will have the following effects:

- It will reduce delays in merging non-controversial changes.
- It will encourage more communication within the team about changes, leading to better overall code quality.
- It will require maintainers to take more responsibility for their changes, including deciding when they are ready to be merged and seeking feedback when needed.
