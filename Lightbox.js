/**
 * @providesModule Lightbox
 */
'use strict';

var React = require('react');
var {
  Children,
  cloneElement,
} = React;
var PropTypes = require('prop-types');
var createReactClass = require('create-react-class');
var {
  Animated,
  TouchableHighlight,
  View,
} = require('react-native');
var TimerMixin = require('react-timer-mixin');

var LightboxOverlay = require('./LightboxOverlay');

var Lightbox = createReactClass({
  mixins: [TimerMixin],

  propTypes: {
    activeProps: PropTypes.object,
    renderHeader: PropTypes.func,
    renderContent: PropTypes.func,
    underlayColor: PropTypes.string,
    backgroundColor: PropTypes.string,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    springConfig: PropTypes.shape({
      tension: PropTypes.number,
      friction: PropTypes.number,
      useNativeDriver: PropTypes.bool,
    }),
    animateOpening: PropTypes.bool,
    animateClosing: PropTypes.bool,
    swipeToDismiss: PropTypes.bool,
    pinchToZoom: PropTypes.bool,
  },

  getDefaultProps: function() {
    return {
      swipeToDismiss: true,
      pinchToZoom: true,
      onOpen: () => {},
      onClose: () => {},
    };
  },

  getInitialState: function() {
    return {
      isOpen: false,
      origin: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
      layoutOpacity: new Animated.Value(1),
    };
  },

  getContent: function() {
    if(this.props.renderContent) {
      return this.props.renderContent();
    } else if(this.props.activeProps) {
      return cloneElement(
        Children.only(this.props.children),
        this.props.activeProps
      );
    }
    return this.props.children;
  },

  getOverlayProps: function() {
    return {
      isOpen: this.state.isOpen,
      origin: this.state.origin,
      renderHeader: this.props.renderHeader,
      swipeToDismiss: this.props.swipeToDismiss,
      pinchToZoom: this.props.pinchToZoom,
      springConfig: this.props.springConfig,
      animateOpening: this.props.animateOpening,
      animateClosing: this.props.animateClosing,
      backgroundColor: this.props.backgroundColor,
      children: this.getContent(),
      onClose: this.onClose,
    };
  },

  open: function() {
    this._root.measureInWindow((x, y, width, height) => {
      this.props.onOpen();

      this.setState({
        isOpen: true,
        origin: {
          width,
          height,
          x,
          y,
        },
      }, () => {
        if(this.props.navigator) {
          var route = {
            component: LightboxOverlay,
            passProps: this.getOverlayProps(),
          };
          var routes = this.props.navigator.getCurrentRoutes();
          routes.push(route);
          this.props.navigator.immediatelyResetRouteStack(routes);
        }
        this.setTimeout(() => {
          this.state.layoutOpacity.setValue(0);
        });
      });
    });
  },

  onClose: function() {
    this.state.layoutOpacity.setValue(1);
    this.setState({
      isOpen: false,
    }, this.props.onClose);
    if(this.props.navigator) {
      var routes = this.props.navigator.getCurrentRoutes();
      routes.pop();
      this.props.navigator.immediatelyResetRouteStack(routes);
    }
  },

  render: function() {
    // measure will not return anything useful if we don't attach an onLayout handler on android
    return (
      <View
        ref={component => this._root = component}
        style={this.props.style}
        onLayout={() => {}}
      >
        <Animated.View style={{opacity: this.state.layoutOpacity}}>
          <TouchableHighlight
            underlayColor={this.props.underlayColor}
            onPress={this.open}
          >
            {this.props.children}
          </TouchableHighlight>
        </Animated.View>
        {this.props.navigator ? false : <LightboxOverlay {...this.getOverlayProps()} />}
      </View>
    );
  }
});

module.exports = Lightbox;
