import OrderForm from '../components/OrderForm.jsx'

export default function CustomOrder() {
  return (
    <div className="container narrow section">
      <h1 className="page-h">Kể giấc mơ của bạn</h1>
      <p className="desc">
        Kể cho InMây nghe ý tưởng của bạn — một món quà, một mô hình, một chi tiết nhỏ xíu — chúng mình sẽ liên hệ để
        cùng biến nó thành sản phẩm in 3D thật.
      </p>
      <OrderForm title="Gửi ý tưởng" />
    </div>
  )
}
