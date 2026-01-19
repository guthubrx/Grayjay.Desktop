import { Accessor, JSX, Setter, createEffect, createMemo, createSignal } from "solid-js";
import { observePosition } from "../utility";
import { useFocus } from "../FocusProvider";


export enum AnchorStyle {
    BottomLeft = 1,
    BottomRight = 2,
    TopLeft = 3,
    TopRight = 4

    //TODO:
    //BottomLeftSide = 5,
    //BottomRightSide = 6,
    //TopLeftSide = 7,
    //TopRightSide = 8,
    //TopLeftCorner = 9,
    //TopRightCorner = 10,
    //BottomLeftCorner = 11,
    //BottomRightCorner = 12
}

export enum AnchorFlags {
    AnchorWidth = 1,
    AnchorHeight = 2,
    AnchorMinWidth = 3,
    AnchorMinHeight = 4
}

export default class Anchor {
    element: HTMLElement | null;
    anchorType: AnchorStyle;
    private anchorEl: HTMLElement | null;
    private useChildAnchor: boolean;

    bounding$: Accessor<DOMRect>;
    style$: Accessor<JSX.CSSProperties>;

    condition$?: Accessor<boolean>;

    private setBounding: Setter<DOMRect>;
    private destroyListener: (()=>void) | undefined = undefined;

    constructor(element: HTMLElement | null, condition: Accessor<boolean> | undefined = undefined, anchorStyle: AnchorStyle = AnchorStyle.BottomLeft, anchorFlags: AnchorFlags[] = [], useChildAnchor: boolean = false) {
        this.element = element;
        this.useChildAnchor = useChildAnchor;
        this.anchorType = anchorStyle;
        this.anchorEl = this.resolveAnchorEl(element);

        const [bounding$, setBounding] = createSignal<DOMRect>(this.anchorEl?.getBoundingClientRect() ?? new DOMRect());
        this.bounding$ = bounding$;
        this.style$ = createMemo<JSX.CSSProperties>(() => {
            const bounds = this.bounding$();
            const effectiveAnchor = this.computeEffectiveAnchorStyle(bounds, this.anchorType);
            const style = this.createBaseStyle(bounds, effectiveAnchor);
            this.applyAnchorFlags(style, bounds, anchorFlags);
            return style;
        });
        this.setBounding = setBounding;
        if(condition) {
            this.condition$ = condition;
            createEffect(()=>{
                console.log("Anchor condition changed: " + condition());
                if(condition())
                    this.start();
                else
                    this.stop();
            });
            if(condition())
                this.start();
        }
    };

    private resolveAnchorEl = (el: HTMLElement | null): HTMLElement | null => {
        if (!el) return null;
        if (!this.useChildAnchor) return el;
        const child = el.querySelector(".menu-anchor") as HTMLElement | null;
        return child ?? el;
    };
        
    setElement = (el: HTMLElement) => {
        console.log("Anchor element changed");
        this.element = el;
        this.anchorEl = this.resolveAnchorEl(el);
        if (this.anchorEl) this.setBounding(this.anchorEl.getBoundingClientRect());
        if (this.destroyListener) {
            this.stop();
            this.start();
        }
    };
    
    setUseChildAnchor = (use: boolean) => {
        if (this.useChildAnchor === use) return;
        this.useChildAnchor = use;

        const prev = this.anchorEl;
        this.anchorEl = this.resolveAnchorEl(this.element);

        if (this.anchorEl !== prev) {
            if (this.destroyListener) this.stop();
            if (this.anchorEl) {
                this.setBounding(this.anchorEl.getBoundingClientRect());
                if (this.condition$ ? this.condition$() : true) this.start();
            }
        }
    };
    
    refreshAnchor = () => {
        const prev = this.anchorEl;
        this.anchorEl = this.resolveAnchorEl(this.element);
        if (this.anchorEl !== prev) {
            if (prev && this.destroyListener) {
                this.stop();
            }
            if (this.anchorEl) {
                this.setBounding(this.anchorEl.getBoundingClientRect());
                if (this.condition$ ? this.condition$() : true) this.start();
            }
        }
    };

    start = () => {
        if (!this.destroyListener && this.anchorEl) {
            const el = this.anchorEl;
            const stopObserve = observePosition(el, this.handleChange);
            const stopScroll = this.attachScrollListeners(el);

            this.destroyListener = () => {
                stopObserve();
                stopScroll();
            };

            this.handleChange(el);
        }
    };

    stop = () => {
        if (this.destroyListener) {
            this.destroyListener();
            this.destroyListener = undefined;
        }
        if (typeof window !== "undefined") {
            window.removeEventListener("resize", this.handleWindowResize);
        }
    };

    private handleWindowResize = () => {
        if (!this.anchorEl) return;
        const newBox = this.anchorEl.getBoundingClientRect();
        this.setBounding(newBox);
    };

    handleChange = (element?: HTMLElement) => {
        const target = element ?? this.anchorEl;
        if (!target) return;
        const oldBox = this.bounding$();
        const newBox = target.getBoundingClientRect();

        if (
            newBox.x !== oldBox.x ||
            newBox.y !== oldBox.y ||
            newBox.width !== oldBox.width ||
            newBox.height !== oldBox.height
        ) {
            console.log("New position:", newBox);
        }

        this.setBounding(newBox);
    };

    private attachScrollListeners(element: HTMLElement): () => void {
        if (typeof window === "undefined") return () => {};

        const disposers: Array<() => void> = [];
        const handler = () => this.handleChange(element);

        window.addEventListener("scroll", handler, { passive: true });
        window.addEventListener("resize", handler);
        disposers.push(() => {
            window.removeEventListener("scroll", handler);
            window.removeEventListener("resize", handler);
        });

        let parent: HTMLElement | null = element.parentElement;
        while (parent) {
            const style = window.getComputedStyle(parent);
            const overflowY = style.overflowY;
            const overflowX = style.overflowX;

            if (
                overflowY === "auto" ||
                overflowY === "scroll" ||
                overflowX === "auto" ||
                overflowX === "scroll"
            ) {
                parent.addEventListener("scroll", handler, { passive: true });
                const current = parent;
                disposers.push(() => {
                    current.removeEventListener("scroll", handler);
                });
            }

            parent = parent.parentElement;
        }

        return () => {
            for (const dispose of disposers) dispose();
        };
    }

    dispose() {
        this.stop();
    }

    private createBaseStyle(bounds: DOMRect, anchor: AnchorStyle): JSX.CSSProperties {
        switch (anchor) {
            case AnchorStyle.TopLeft:
                return {
                    bottom: (window.innerHeight - bounds.top) + "px",
                    left: bounds.left + "px",
                };
            case AnchorStyle.TopRight:
                return {
                    bottom: (window.innerHeight - bounds.top) + "px",
                    right: (window.innerWidth - bounds.right) + "px",
                };
            case AnchorStyle.BottomLeft:
                return {
                    top: bounds.top + bounds.height + "px",
                    left: bounds.left + "px",
                };
            case AnchorStyle.BottomRight:
            default:
                return {
                    top: bounds.top + bounds.height + "px",
                    right: (window.innerWidth - bounds.right) + "px",
                };
        }
    }

    private applyAnchorFlags(style: JSX.CSSProperties, bounds: DOMRect, anchorFlags: AnchorFlags[]) {
        for (let flag of anchorFlags) {
            switch (flag) {
                case AnchorFlags.AnchorWidth:
                    style.width = bounds.width + "px";
                    break;
                case AnchorFlags.AnchorMinWidth:
                    style["min-width"] = bounds.width + "px";
                    break;
                case AnchorFlags.AnchorHeight:
                    style.height = bounds.height + "px";
                    break;
                case AnchorFlags.AnchorMinHeight:
                    style["min-height"] = bounds.height + "px";
                    break;
            }
        }
    }

    private computeEffectiveAnchorStyle(bounds: DOMRect, preferred: AnchorStyle): AnchorStyle {
        if (typeof window === "undefined") return preferred;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (!viewportWidth || !viewportHeight) return preferred;

        const spaceTop = bounds.top;
        const spaceBottom = viewportHeight - bounds.bottom;
        const spaceRightwards = viewportWidth - bounds.right;
        const spaceLeftwards = bounds.left;
        const preferredIsTop = preferred === AnchorStyle.TopLeft || preferred === AnchorStyle.TopRight;
        const preferredIsLeft = preferred === AnchorStyle.TopLeft || preferred === AnchorStyle.BottomLeft;

        const MIN_DELTA = 32;

        let useTop: boolean;
        if (Math.abs(spaceTop - spaceBottom) <= MIN_DELTA) {
            useTop = preferredIsTop;
        } else {
            useTop = spaceTop > spaceBottom;
        }

        let useLeft: boolean;
        if (Math.abs(spaceRightwards - spaceLeftwards) <= MIN_DELTA) {
            useLeft = preferredIsLeft;
        } else {
            useLeft = spaceRightwards > spaceLeftwards;
        }

        if (useTop && useLeft) return AnchorStyle.TopLeft;
        if (useTop && !useLeft) return AnchorStyle.TopRight;
        if (!useTop && useLeft) return AnchorStyle.BottomLeft;
        return AnchorStyle.BottomRight;
    }
}