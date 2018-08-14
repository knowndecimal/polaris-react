import * as React from 'react';
import {autobind} from '@shopify/javascript-utilities/decorators';
import {classNames} from '@shopify/react-utilities/styles';
import {CSSTransition} from 'react-transition-group';
import {navigationBarCollapsed} from '../../utilities/breakpoints';
import {Button, Icon, EventListener, ToastProps} from '../../components';
import {dataPolarisTopBar, layer} from '../shared';
import {TrapFocus} from '../Focus';
import {
  withAppProvider,
  WithAppProviderProps,
} from '../../components/AppProvider';

import {FrameContext, frameContextTypes} from '../types';

import {
  ToastManager,
  Loading,
  ContextualSaveBar,
  ContextualSaveBarProps,
} from './components';
import * as styles from './Frame.scss';

export interface Props {
  /** Accepts a top bar component that will be rendered at the top-most portion of an application frame */
  topBar?: React.ReactNode;
  /** Accepts a navigation component that will be rendered in the left sidebar of an application frame */
  navigation?: React.ReactNode;
  /** Accepts a global ribbon component that will be rendered fixed to the bottom of an application frame */
  globalRibbon?: React.ReactNode;
  /** A boolean property indicating whether the mobile navigation is currently visible */
  showMobileNavigation?: boolean;
  /** A callback function to handle clicking the mobile navigation dismiss button */
  onNavigationDismiss?(): void;
}

export interface State {
  mobileView?: boolean;
  skipFocused?: boolean;
  bannerHeight: number;
  loadingStack: number;
  toastMessages: (ToastProps & {id: string})[];
  contextualSaveBar: ContextualSaveBarProps | null;
}

export const APP_FRAME_MAIN = 'AppFrameMain';
const APP_FRAME_NAV = 'AppFrameNav';
const APP_FRAME_TOP_BAR = 'AppFrameTopBar';
const APP_FRAME_LOADING_BAR = 'AppFrameLoadingBar';

export type CombinedProps = Props & WithAppProviderProps;

export class Frame extends React.PureComponent<CombinedProps, State> {
  static childContextTypes = frameContextTypes;

  state: State = {
    skipFocused: false,
    bannerHeight: 0,
    loadingStack: 0,
    toastMessages: [],
    contextualSaveBar: null,
    mobileView: isMobileView(),
  };

  private bannerContainer: HTMLDivElement | null = null;

  getChildContext(): FrameContext {
    return {
      frame: {
        showToast: this.showToast,
        hideToast: this.hideToast,
        startLoading: this.startLoading,
        stopLoading: this.stopLoading,
        setContextualSaveBar: this.setContextualSaveBar,
        removeContextualSaveBar: this.removeContextualSaveBar,
      },
    };
  }

  componentDidMount() {
    this.handleResize();
  }

  componentWillReceiveProps() {
    const {bannerContainer} = this;
    if (bannerContainer) {
      this.setState({
        bannerHeight: bannerContainer.offsetHeight,
      });
    }
  }

  render() {
    const {
      skipFocused,
      bannerHeight,
      loadingStack,
      toastMessages,
      contextualSaveBar,
      mobileView,
    } = this.state;
    const {
      children,
      navigation,
      topBar,
      globalRibbon,
      showMobileNavigation,
      polaris: {intl},
    } = this.props;

    const navClassName = classNames(
      styles.Navigation,
      showMobileNavigation && styles['Navigation-visible'],
    );

    const tabIndex = showMobileNavigation ? 0 : -1;
    const contentStyles = {paddingBottom: `${bannerHeight}px`};

    const NavWrapper = mobileView ? this.NavTransition : 'div';

    const navigationMarkup = navigation ? (
      <NavWrapper>
        <div
          className={navClassName}
          onKeyDown={this.handleNavKeydown}
          id={APP_FRAME_NAV}
        >
          {navigation}
          <button
            type="button"
            className={styles.NavigationDismiss}
            onClick={this.handleNavigationDismiss}
            aria-hidden={!showMobileNavigation}
            aria-label={intl.translate(
              'Polaris.Frame.Navigation.closeMobileNavigationLabel',
            )}
            tabIndex={tabIndex}
          >
            <Icon source="cancel" color="white" />
          </button>
        </div>
      </NavWrapper>
    ) : null;

    const loadingMarkup =
      loadingStack > 0 ? (
        <div className={styles.LoadingBar} id={APP_FRAME_LOADING_BAR}>
          <Loading />
        </div>
      ) : null;

    const contextualSaveBarClassName = classNames(
      styles.ContextualSaveBar,
      contextualSaveBar && styles['ContextualSaveBar-visible'],
    );

    const contextualSaveBarMarkup = contextualSaveBar && (
      <div className={contextualSaveBarClassName}>
        <ContextualSaveBar {...contextualSaveBar} />
      </div>
    );

    const topBarMarkup = topBar ? (
      <div
        className={styles.TopBar}
        {...layer.props}
        {...dataPolarisTopBar.props}
        id={APP_FRAME_TOP_BAR}
      >
        {topBar}
      </div>
    ) : null;

    const bannerMarkup = globalRibbon ? (
      <div
        className={styles.Banners}
        testID="FrameBannerContainer"
        ref={this.setBannerContainer}
      >
        {globalRibbon}
      </div>
    ) : null;

    const navigationOverlayClassName = classNames(
      styles.NavigationOverlay,
      showMobileNavigation && styles['NavigationOverlay-covering'],
    );

    const skipClassName = classNames(
      styles.Skip,
      skipFocused && styles.focused,
    );

    const skipMarkup = (
      <div className={skipClassName}>
        <Button
          onClick={this.handleClick}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
        >
          {intl.translate('Polaris.Frame.skipToContent')}
        </Button>
      </div>
    );

    const navigationAttributes = navigation
      ? {
          'data-has-navigation': true,
        }
      : {};

    const frameClassName = classNames(
      styles.Frame,
      navigation && styles.hasNav,
      topBar && styles.hasTopBar,
    );

    return (
      <div
        className={frameClassName}
        {...layer.props}
        {...navigationAttributes}
      >
        {skipMarkup}
        {topBarMarkup}
        {contextualSaveBarMarkup}
        {loadingMarkup}
        <div
          className={navigationOverlayClassName}
          onClick={this.handleNavigationDismiss}
          onTouchStart={this.handleNavigationDismiss}
        />
        {navigationMarkup}
        <main
          className={styles.Main}
          id={APP_FRAME_MAIN}
          data-has-banner={Boolean(globalRibbon)}
        >
          <div style={contentStyles} testID="FrameContentStyles">
            {children}
          </div>
        </main>
        <ToastManager toastMessages={toastMessages} />
        {bannerMarkup}
        <EventListener event="resize" handler={this.handleResize} />
      </div>
    );
  }

  @autobind
  private NavTransition({children}: any) {
    const {showMobileNavigation} = this.props;
    return (
      <TrapFocus trapping>
        <CSSTransition
          appear
          exit
          in={showMobileNavigation}
          timeout={100}
          classNames={navTransitionClasses}
          mountOnEnter
          unmountOnExit
        >
          {children}
        </CSSTransition>
      </TrapFocus>
    );
  }

  @autobind
  private showToast(toast: {id: string} & ToastProps) {
    this.setState(({toastMessages}: State) => {
      const hasToastById =
        toastMessages.find(({id}) => id === toast.id) != null;
      return {
        toastMessages: hasToastById ? toastMessages : [...toastMessages, toast],
      };
    });
  }

  @autobind
  private hideToast({id}: {id: string}) {
    this.setState(({toastMessages}: State) => {
      return {
        toastMessages: toastMessages.filter(({id: toastId}) => id !== toastId),
      };
    });
  }

  @autobind
  private setContextualSaveBar(props: ContextualSaveBarProps) {
    this.setState({contextualSaveBar: {...props}});
  }

  @autobind
  private removeContextualSaveBar() {
    this.setState({contextualSaveBar: null});
  }

  @autobind
  private startLoading() {
    this.setState(({loadingStack}: State) => ({
      loadingStack: loadingStack + 1,
    }));
  }

  @autobind
  private stopLoading() {
    this.setState(({loadingStack}: State) => ({
      loadingStack: Math.max(0, loadingStack - 1),
    }));
  }

  @autobind
  private handleResize() {
    const {bannerContainer} = this;
    const {mobileView} = this.state;

    if (isMobileView() && !mobileView) {
      this.setState({mobileView: true});
    } else if (!isMobileView() && mobileView) {
      this.setState({mobileView: false});
    }

    if (bannerContainer == null) {
      return;
    }

    this.setState({
      bannerHeight: bannerContainer.offsetHeight,
    });
  }

  @autobind
  private handleClick() {
    focusAppFrameMain();
  }

  @autobind
  private handleFocus() {
    this.setState({skipFocused: true});
  }

  @autobind
  private handleBlur() {
    this.setState({skipFocused: false});
  }

  @autobind
  private handleNavigationDismiss() {
    const {onNavigationDismiss} = this.props;
    if (onNavigationDismiss != null) {
      onNavigationDismiss();
    }
  }

  @autobind
  private setBannerContainer(node: HTMLDivElement) {
    this.bannerContainer = node;
  }

  @autobind
  private handleNavKeydown(event: React.KeyboardEvent<HTMLElement>) {
    const {key} = event;

    if (key === 'Escape') {
      this.handleNavigationDismiss();
    }
  }
}

const navTransitionClasses = {
  enter: classNames(styles['Navigation-enter']),
  enterActive: classNames(styles['Navigation-enterActive']),
  enterDone: classNames(styles['Navigation-enterActive']),
  exit: classNames(styles['Navigation-exit']),
  exitActive: classNames(styles['Navigation-exitActive']),
};

function focusAppFrameMain() {
  window.location.assign(`${window.location.pathname}#${APP_FRAME_MAIN}`);
}

function isMobileView() {
  return navigationBarCollapsed().matches;
}

export default withAppProvider<Props>()(Frame);