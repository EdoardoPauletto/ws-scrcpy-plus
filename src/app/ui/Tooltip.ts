import '../../style/tooltip.css';

// Material "plain tooltip": one floating element positioned next to the hovered/focused/tapped target.
// It lives in <body>, so scrolling containers (e.g. a dialog body) don't clip it.
export default class Tooltip {
    private static element?: HTMLElement;
    private static target?: HTMLElement;
    private static readonly MARGIN = 8;
    private static readonly OFFSET = 4;

    // toggleOnTap: for info buttons, whose only purpose is to show the tooltip
    public static attach(target: HTMLElement, text: string, toggleOnTap = true): void {
        if (!target.textContent?.trim()) {
            target.setAttribute('aria-label', text);
        }
        target.addEventListener('mouseenter', () => this.show(target, text));
        target.addEventListener('focus', () => this.show(target, text));
        target.addEventListener('mouseleave', this.hide);
        target.addEventListener('blur', this.hide);
        if (!toggleOnTap) {
            target.addEventListener('click', this.hide);
            return;
        }
        // Touch screens have no hover: a tap shows the tooltip, a tap elsewhere hides it
        target.addEventListener('click', (event) => {
            event.preventDefault();
            this.show(target, text);
        });
    }

    public static hide = (): void => {
        Tooltip.target = undefined;
        Tooltip.element?.classList.remove('visible');
    };

    private static getElement(): HTMLElement {
        if (!this.element) {
            const element = document.createElement('div');
            element.className = 'md-tooltip';
            element.setAttribute('role', 'tooltip');
            document.body.appendChild(element);
            window.addEventListener('scroll', this.hide, true);
            window.addEventListener('resize', this.hide);
            document.addEventListener(
                'pointerdown',
                (event) => {
                    if (this.target && !this.target.contains(event.target as Node)) {
                        this.hide();
                    }
                },
                true,
            );
            this.element = element;
        }
        if (!this.element.isConnected) {
            document.body.appendChild(this.element);
        }
        return this.element;
    }

    private static show(target: HTMLElement, text: string): void {
        const element = this.getElement();
        this.target = target;
        element.innerText = text;
        element.classList.add('visible');
        const rect = target.getBoundingClientRect();
        const { width, height } = element.getBoundingClientRect();
        const maxLeft = window.innerWidth - width - this.MARGIN;
        const left = Math.max(this.MARGIN, Math.min(rect.left + rect.width / 2 - width / 2, maxLeft));
        let top = rect.bottom + this.OFFSET;
        if (top + height > window.innerHeight - this.MARGIN) {
            top = rect.top - height - this.OFFSET;
        }
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
    }
}
