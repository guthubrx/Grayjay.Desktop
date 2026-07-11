export interface SubscriptionPagerCandidate<T> {
    itemCount: number;
    value: T;
}

export interface SubscriptionPagerSelection<T> {
    bootstrap?: SubscriptionPagerCandidate<T>;
    cache?: SubscriptionPagerCandidate<T>;
    live?: SubscriptionPagerCandidate<T>;
    liveReady?: boolean;
}

function hasItems<T>(candidate?: SubscriptionPagerCandidate<T>): candidate is SubscriptionPagerCandidate<T> {
    return !!candidate && candidate.itemCount > 0;
}

export function selectSubscriptionPager<T>(selection: SubscriptionPagerSelection<T>): SubscriptionPagerCandidate<T> | undefined {
    if (selection.liveReady && hasItems(selection.live))
        return selection.live;
    if (hasItems(selection.cache))
        return selection.cache;
    if (hasItems(selection.bootstrap))
        return selection.bootstrap;
    if (hasItems(selection.live))
        return selection.live;
    return undefined;
}
