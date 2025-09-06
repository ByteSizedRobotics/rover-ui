<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  let { children } = $props();
</script>

<div class="navbar bg-base-300">
  <div class="navbar-start">
    <a href="/" class="btn btn-ghost text-xl">Control Centre</a>
  </div>
  <div class="navbar-center hidden lg:flex">
    {#if $page.url.pathname !== '/'}
      <ul class="menu menu-horizontal px-1 flex gap-4">
        <li><a href="/rovers" class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">Rovers</a></li>
        <li><a href="/paths" class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">Paths</a></li>
        <li><a href="/potholes" class="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">Potholes</a></li>
      </ul>
    {/if}
  </div>
  <div class="navbar-end">
    <a href="/account" class="btn">Account</a>
  </div>
</div>
{@render children()}
