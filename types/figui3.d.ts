import * as React from 'react';

type FigCustomElementProps<T = HTMLElement> = React.DetailedHTMLProps<React.HTMLAttributes<T>, T> & {
  class?: string;
};

export interface FigButtonProps extends FigCustomElementProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructiveSecondary' | 'destructiveGhost' | 'destructiveLink' | 'link' | 'input' | 'overlay';
  size?: 'small' | 'compact' | 'medium' | 'large';
  icon?: boolean | string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset' | 'select' | 'upload';
  selected?: boolean;
}

export interface FigSwitchProps extends FigCustomElementProps {
  checked?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  label?: string;
}

export interface FigSegmentedControlProps extends FigCustomElementProps {
  name?: string;
  value?: string;
  disabled?: boolean;
  size?: 'small' | 'large' | 'compact';
  full?: boolean;
  animated?: boolean;
  sizing?: 'equal' | 'auto';
}

export interface FigSegmentProps extends FigCustomElementProps {
  value?: string;
  selected?: boolean;
  disabled?: boolean;
}

export interface FigSelectProps extends FigCustomElementProps {
  value?: string;
  disabled?: boolean;
  label?: string;
  options?: string;
  open?: boolean;
  variant?: string;
  position?: string;
  offset?: string;
  closedby?: string;
}

export interface FigSelectOptionsProps extends FigCustomElementProps {
  slot?: string;
}

export interface FigSelectOptionProps extends FigCustomElementProps {
  value?: string;
  label?: string;
  disabled?: boolean;
  selected?: boolean;
}

export interface PropskitSliderProps extends FigCustomElementProps {
  label?: string;
  value?: string | number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  units?: string;
  type?: 'range' | 'opacity' | 'hue' | 'stepper' | 'delta';
  disabled?: boolean;
  direction?: 'horizontal' | 'vertical';
  size?: 'small' | 'large' | '';
  variant?: 'minimal' | '';
}

export interface PropskitNumberProps extends FigCustomElementProps {
  label?: string;
  value?: string | number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  precision?: string | number;
  units?: string;
  disabled?: boolean;
  direction?: 'horizontal' | 'vertical';
  steppers?: boolean;
  size?: 'small' | 'large' | '';
  variant?: 'minimal' | '';
}

export interface PropskitSwitchProps extends FigCustomElementProps {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  direction?: 'horizontal' | 'vertical';
}

export interface PropskitSelectProps extends FigCustomElementProps {
  label?: string;
  value?: string;
  options?: string;
  disabled?: boolean;
  direction?: 'horizontal' | 'vertical';
}

export interface FigPopupProps extends FigCustomElementProps<HTMLDialogElement> {
  open?: boolean;
  anchor?: string | HTMLElement | null;
  position?: string;
  offset?: string | number;
  variant?: 'popover' | 'tooltip' | string;
  theme?: string;
  drag?: boolean;
  handle?: string;
  autoresize?: boolean;
  closedby?: 'any' | 'none' | 'closerequest' | string;
  title?: string;
  dropdown?: boolean;
}

export interface FigDialogProps extends FigCustomElementProps<HTMLDialogElement> {
  open?: boolean;
  modal?: boolean;
  drag?: boolean;
  handle?: string;
  position?: string;
  closedby?: 'any' | 'none' | 'closerequest' | string;
  title?: string;
  autoresize?: boolean;
}

export interface FigTooltipProps extends FigCustomElementProps {
  text?: string;
  action?: 'hover' | 'click' | 'manual' | string;
  delay?: number;
  offset?: string;
  show?: boolean;
  open?: boolean;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'fig-button': FigButtonProps;
      'fig-switch': FigSwitchProps;
      'fig-segmented-control': FigSegmentedControlProps;
      'fig-segment': FigSegmentProps;
      'fig-select': FigSelectProps;
      'fig-select-options': FigSelectOptionsProps;
      'fig-select-option': FigSelectOptionProps;
      'fig-tooltip': FigTooltipProps;
      'propskit-slider': PropskitSliderProps;
      'propskit-number': PropskitNumberProps;
      'propskit-switch': PropskitSwitchProps;
      'propskit-select': PropskitSelectProps;
      'fig-popup': FigPopupProps;
      'fig-dialog': FigDialogProps;
      dialog: React.DetailedHTMLProps<React.DialogHTMLAttributes<HTMLDialogElement>, HTMLDialogElement> & {
        is?: string;
        anchor?: string | HTMLElement | null;
        position?: string;
        offset?: string | number;
        variant?: string;
        theme?: string;
        modal?: boolean | string;
        drag?: boolean | string;
        handle?: string;
        closedby?: string;
        autoresize?: boolean | string;
      };
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'fig-button': FigButtonProps;
      'fig-switch': FigSwitchProps;
      'fig-segmented-control': FigSegmentedControlProps;
      'fig-segment': FigSegmentProps;
      'fig-select': FigSelectProps;
      'fig-select-options': FigSelectOptionsProps;
      'fig-select-option': FigSelectOptionProps;
      'fig-tooltip': FigTooltipProps;
      'propskit-slider': PropskitSliderProps;
      'propskit-number': PropskitNumberProps;
      'propskit-switch': PropskitSwitchProps;
      'propskit-select': PropskitSelectProps;
      'fig-popup': FigPopupProps;
      'fig-dialog': FigDialogProps;
      dialog: React.DetailedHTMLProps<React.DialogHTMLAttributes<HTMLDialogElement>, HTMLDialogElement> & {
        is?: string;
        anchor?: string | HTMLElement | null;
        position?: string;
        offset?: string | number;
        variant?: string;
        theme?: string;
        modal?: boolean | string;
        drag?: boolean | string;
        handle?: string;
        closedby?: string;
        autoresize?: boolean | string;
      };
    }
  }
}

declare module '@rogieking/figui3' {
  const content: unknown;
  export default content;
}

declare module '@rogieking/figui3/*' {
  const content: unknown;
  export default content;
}




