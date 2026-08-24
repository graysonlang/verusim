export interface MenuHandle {
  close: (restoreFocus?: boolean) => void;
  set: (open: boolean, restoreFocus?: boolean) => void;
}

export interface MenuRegistration {
  menu: HTMLElement;
  /** Runs after the menu becomes visible; owns focus placement and any measured repositioning. */
  onOpened?: (triggerBounds: DOMRect) => void;
  /** Runs before the menu becomes visible, while it can be positioned without reflow. */
  position?: (triggerBounds: DOMRect) => void;
  trigger: HTMLButtonElement;
}

export interface MenuGroup {
  closeAll: () => void;
  register: (registration: MenuRegistration) => MenuHandle;
}

/**
 * One exclusive group of dropdown menus: opening any member closes the others,
 * and every member shares the same hidden/aria-expanded/focus-restoration contract.
 */
export function createMenuGroup(): MenuGroup {
  const members: { registration: MenuRegistration; set: MenuHandle['set'] }[] = [];

  function register(registration: MenuRegistration): MenuHandle {
    const set = (open: boolean, restoreFocus = false): void => {
      let triggerBounds: DOMRect | undefined;
      if (open) {
        for (const other of members) {
          if (other.registration !== registration) other.set(false);
        }
        triggerBounds = registration.trigger.getBoundingClientRect();
        registration.position?.(triggerBounds);
      }
      registration.menu.hidden = !open;
      registration.trigger.setAttribute('aria-expanded', String(open));
      if (open) {
        registration.onOpened?.(triggerBounds ?? registration.trigger.getBoundingClientRect());
      } else if (restoreFocus) {
        registration.trigger.focus();
      }
    };
    members.push({ registration, set });
    return { close: restoreFocus => set(false, restoreFocus), set };
  }

  function closeAll(): void {
    for (const member of members) member.set(false);
  }

  return { closeAll, register };
}
