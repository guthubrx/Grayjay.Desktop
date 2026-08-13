using Grayjay.ClientServer.Pagers;
using Grayjay.Engine.Pagers;

namespace Grayjay.Desktop.Tests
{
    [TestClass]
    public class FilterPagerTests
    {
        [TestMethod]
        public void Test_FilterPager()
        {
            var source = Enumerable.Range(0, 30).ToArray();
            var pager = new AdhocPager<int>(page => source.Skip((page - 1) * 5).Take(5).ToArray());
            var filtered = new FilterPager<int>(pager, x => x % 4 == 0, 3);

            CollectionAssert.AreEqual(new[] { 0, 4, 8 }, filtered.GetResults());
            Assert.IsTrue(filtered.HasMorePages());

            filtered.NextPage();
            CollectionAssert.AreEqual(new[] { 12, 16, 20 }, filtered.GetResults());
            Assert.IsTrue(filtered.HasMorePages());

            filtered.NextPage();
            CollectionAssert.AreEqual(new[] { 24, 28 }, filtered.GetResults());
            Assert.IsFalse(filtered.HasMorePages());
        }
    }
}
