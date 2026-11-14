import { View, div } from "gpui-kit";
import { theme } from "herdr";
import { icon } from "../../kit/kit.js";

export default class Hello extends View {
  render() {
    const t = theme();
    return div().bg(t.popover).rounded(6).child(icon("hello")).child("hello");
  }
}
