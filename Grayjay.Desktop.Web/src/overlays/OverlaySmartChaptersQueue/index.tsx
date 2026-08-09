import { Component, For, Show, createMemo, createSignal, onMount } from 'solid-js';

import { IHighlightIndexJob } from '../../backend/HighlightsBackend';
import iconClose from '../../assets/icons/icon24_close.svg';
import Button from '../../components/buttons/Button';
import OverlayCustomDialog from '../OverlayCustomDialog';
import {
    hasGeneratorCommand,
    indexJobs$,
    pendingIndexJobCount,
    prioritizeIndexJob,
    refreshIndexJobs,
    removeIndexJob
} from '../../state/StateHighlightsIndexer';
import UIOverlay from '../../state/UIOverlay';
import styles from './index.module.css';

const OverlaySmartChaptersQueue: Component = () => {
    const [busyUrl$, setBusyUrl] = createSignal<string | undefined>();
    const jobs$ = createMemo(() => Object.values(indexJobs$()));
    const running$ = createMemo(() => jobs$()
        .filter(job => job.status === 'running')
        .sort((left, right) => dateValue(left.startedAt) - dateValue(right.startedAt)));
    const queued$ = createMemo(() => jobs$()
        .filter(job => job.status === 'queued')
        .sort((left, right) => (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER)));
    const recent$ = createMemo(() => jobs$()
        .filter(job => job.status === 'done' || job.status === 'error' || job.status === 'skipped')
        .sort((left, right) => dateValue(right.completedAt) - dateValue(left.completedAt))
        .slice(0, 12));

    onMount(() => {
        void refreshIndexJobs().catch((error) => console.warn('Could not load Smart Chapters queue', error));
    });

    const prioritize = async (job: IHighlightIndexJob) => {
        setBusyUrl(job.url);
        try {
            await prioritizeIndexJob(job.url);
        } catch (error: any) {
            UIOverlay.toast('Could not prioritize Smart Chapters job: ' + (error?.message ?? error));
        } finally {
            setBusyUrl(undefined);
        }
    };

    const remove = async (job: IHighlightIndexJob) => {
        setBusyUrl(job.url);
        try {
            await removeIndexJob(job.url);
        } catch (error: any) {
            UIOverlay.toast('Could not remove Smart Chapters job: ' + (error?.message ?? error));
        } finally {
            setBusyUrl(undefined);
        }
    };

    return (
        <OverlayCustomDialog hideHeader={true} onRootClick={() => UIOverlay.dismiss()} focusScope={true}>
            <div class={styles.root}>
                <div class={styles.header}>
                    <div>
                        <div class={styles.title}>Smart Chapters</div>
                        <div class={styles.summary}>
                            {pendingIndexJobCount()} active {pendingIndexJobCount() === 1 ? 'job' : 'jobs'}
                        </div>
                    </div>
                    <button class={styles.closeButton} type="button" aria-label="Close Smart Chapters" onClick={() => UIOverlay.dismiss()}>
                        <img src={iconClose} />
                    </button>
                </div>

                <Show when={!hasGeneratorCommand()}>
                    <div class={styles.empty}>Configure a Smart Chapters generator in Settings to add work to this queue.</div>
                </Show>

                <section class={styles.section}>
                    <div class={styles.sectionTitle}>In progress</div>
                    <Show when={running$().length > 0} fallback={<div class={styles.empty}>No generation is running.</div>}>
                        <For each={running$()}>{job => <JobRow job={job} />}</For>
                    </Show>
                </section>

                <section class={styles.section}>
                    <div class={styles.sectionTitle}>Up next</div>
                    <Show when={queued$().length > 0} fallback={<div class={styles.empty}>No video is waiting.</div>}>
                        <For each={queued$()}>{job => (
                            <JobRow
                                job={job}
                                busy={busyUrl$() === job.url}
                                onPrioritize={() => void prioritize(job)}
                                onRemove={() => void remove(job)}
                            />
                        )}</For>
                    </Show>
                </section>

                <Show when={recent$().length > 0}>
                    <section class={styles.section}>
                        <div class={styles.sectionTitle}>Recent</div>
                        <For each={recent$()}>{job => <JobRow job={job} />}</For>
                    </section>
                </Show>
            </div>
        </OverlayCustomDialog>
    );
};

interface JobRowProps {
    job: IHighlightIndexJob;
    busy?: boolean;
    onPrioritize?: () => void;
    onRemove?: () => void;
}

const JobRow: Component<JobRowProps> = (props) => {
    return (
        <div class={styles.job}>
            <Show when={props.job.thumbnail} fallback={<div class={styles.thumbnailPlaceholder} />}>
                <img class={styles.thumbnail} src={props.job.thumbnail} />
            </Show>
            <div class={styles.jobBody}>
                <div class={styles.jobTitle}>{displayTitle(props.job)}</div>
                <Show when={props.job.author}>
                    <div class={styles.jobAuthor}>{props.job.author}</div>
                </Show>
                <div class={styles.jobMeta}>
                    <span classList={{ [styles.error]: props.job.status === 'error' }}>{statusLabel(props.job)}</span>
                    <span>{sourceLabel(props.job.source)}</span>
                </div>
                <Show when={props.job.error && props.job.status === 'error'}>
                    <div class={styles.errorDetail}>{props.job.error}</div>
                </Show>
            </div>
            <Show when={props.onPrioritize || props.onRemove}>
                <div class={styles.actions}>
                    <Show when={props.onPrioritize}>
                        <Button text="Prioritize" small={true} onClick={() => props.onPrioritize?.()} style={{ opacity: props.busy ? 0.6 : 1 }} />
                    </Show>
                    <Show when={props.onRemove}>
                        <Button text="Remove" small={true} onClick={() => props.onRemove?.()} style={{ opacity: props.busy ? 0.6 : 1 }} />
                    </Show>
                </div>
            </Show>
        </div>
    );
};

function displayTitle(job: IHighlightIndexJob): string {
    if (job.title?.trim())
        return job.title;

    try {
        const parsed = new URL(job.url);
        const videoId = parsed.searchParams.get('v');
        return videoId ? `${parsed.hostname} · ${videoId}` : parsed.hostname;
    } catch {
        return job.url;
    }
}

function statusLabel(job: IHighlightIndexJob): string {
    switch (job.status) {
        case 'running': return 'Generating';
        case 'queued': return job.position ? `Queue position ${job.position}` : 'Queued';
        case 'done': return 'Ready';
        case 'error': return 'Failed';
        case 'skipped': return 'Removed';
    }
}

function sourceLabel(source: IHighlightIndexJob['source']): string {
    switch (source) {
        case 'manual': return 'Requested manually';
        case 'playback': return 'Triggered from playback';
        case 'precompute': return 'Scheduled precompute';
        default: return 'Smart Chapters';
    }
}

function dateValue(value: string | undefined): number {
    return value ? new Date(value).getTime() : 0;
}

export default OverlaySmartChaptersQueue;
