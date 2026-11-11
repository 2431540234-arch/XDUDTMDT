// Điều hướng sau thanh toán: URL tương đối của FE (/checkout/success…) đi bằng router; URL cổng thanh toán (VNPAY, https://…)
// phải rời hẳn ứng dụng nên dùng window.location.
export function navigateTo(router: { push: (url: string) => void }, url: string) {
  if (/^https?:\/\//i.test(url)) window.location.assign(url);
  else router.push(url);
}
